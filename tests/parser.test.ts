/**
 * Tests for CV parsing.
 *
 * Every fixture here is a real file built at test time — a genuine PDF from
 * `pdf-lib` and a genuine .docx from `docx` — rather than a hand-written byte
 * string. A test that only checks the first four bytes proves the magic-byte
 * check works and nothing about whether the file can actually be read.
 *
 * The rejection cases matter as much as the happy path. `file.type` is
 * attacker-controlled, so these assert that the bytes decide.
 */

import { Document, Packer, Paragraph } from 'docx';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import {
  FileCvParser,
  UnsupportedFileError,
  detectFormat,
} from '@/lib/infrastructure/parser';

const CV_LINES = [
  'Thabo Mokoena',
  'thabo.mokoena@example.co.za',
  '+27 82 555 0134',
  '',
  'Professional Summary',
  'Backend developer with six years building payment systems in Java.',
  '',
  'Experience',
  'Senior Developer, Absa Bank',
  'Led a team of five engineers delivering a payments API in Java.',
  '',
  'Skills',
  'Java, PostgreSQL, Docker',
];

async function buildPdf(lines: readonly string[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([595, 842]);

  let y = 800;
  for (const line of lines) {
    page.drawText(line, { x: 50, y, size: 11, font });
    y -= 18;
  }

  return pdf.save();
}

async function buildDocx(lines: readonly string[]): Promise<Uint8Array> {
  const document = new Document({
    sections: [
      { children: lines.map((text) => new Paragraph({ text })) },
    ],
  });
  const buffer = await Packer.toBuffer(document);
  return new Uint8Array(buffer);
}

const parser = new FileCvParser();

describe('format detection from magic bytes', () => {
  it('recognises a real PDF', async () => {
    expect(detectFormat(await buildPdf(CV_LINES))).toBe('pdf');
  });

  it('recognises a real .docx', async () => {
    expect(detectFormat(await buildDocx(CV_LINES))).toBe('docx');
  });

  /**
   * A .docx is a ZIP, and so is a .xlsx and so is an arbitrary archive. The
   * ZIP header alone is not enough to conclude "Word document".
   */
  it('rejects a ZIP that is not a Word document', () => {
    const zip = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04, ...Buffer.from('not-a-word-document'),
    ]);
    expect(() => detectFormat(zip)).toThrow(UnsupportedFileError);
  });

  it('rejects an old-format .doc with a useful message', () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0x00, 0x00]);
    expect(() => detectFormat(ole)).toThrow(/save it as \.docx/i);
  });

  it('rejects an image', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(() => detectFormat(png)).toThrow(UnsupportedFileError);
  });

  it('rejects plain text', () => {
    expect(() => detectFormat(new Uint8Array(Buffer.from('Thabo Mokoena')))).toThrow(
      UnsupportedFileError,
    );
  });
});

describe('parsing', () => {
  it('extracts the text of a PDF CV', async () => {
    const parsed = await parser.parse(await buildPdf(CV_LINES));

    expect(parsed.format).toBe('pdf');
    expect(parsed.text).toContain('Thabo Mokoena');
    expect(parsed.text).toContain('Led a team of five engineers');
    expect(parsed.text).toContain('PostgreSQL');
  });

  it('extracts the text of a .docx CV', async () => {
    const parsed = await parser.parse(await buildDocx(CV_LINES));

    expect(parsed.format).toBe('docx');
    expect(parsed.text).toContain('Thabo Mokoena');
    expect(parsed.text).toContain('Led a team of five engineers');
    expect(parsed.text).toContain('PostgreSQL');
  });

  it('rejects an empty file', async () => {
    await expect(parser.parse(new Uint8Array(0))).rejects.toThrow('That file is empty.');
  });

  it('rejects a file over the size cap before parsing it', async () => {
    // 6 MB of PDF header. It never reaches pdf.js, which is the point: the cap
    // is there to stop a large hostile file being handed to a parser at all.
    const oversized = new Uint8Array(6 * 1024 * 1024);
    oversized.set([0x25, 0x50, 0x44, 0x46]);

    await expect(parser.parse(oversized)).rejects.toThrow(/larger than 5 MB/);
  });

  /**
   * A scanned CV is a picture of a page: it parses fine and yields almost no
   * text. Failing with a clear explanation beats storing an empty CV.
   */
  it('rejects a PDF with no usable text layer', async () => {
    const nearlyEmpty = await buildPdf(['x']);
    await expect(parser.parse(nearlyEmpty)).rejects.toThrow(/No readable text/);
  });
});

/**
 * The end-to-end shape of M2: a real file goes in, and what comes out the other
 * side of de-identification carries none of the identifiers.
 */
describe('parse then de-identify', () => {
  it('produces content safe to send onward', async () => {
    const { deidentify } = await import('@/lib/domain/identity');

    const parsed = await parser.parse(await buildDocx(CV_LINES));
    const { identity, content } = deidentify(parsed.text);

    expect(identity.fullName).toBe('Thabo Mokoena');
    expect(identity.email).toBe('thabo.mokoena@example.co.za');

    expect(content).not.toContain('Thabo');
    expect(content).not.toContain('Mokoena');
    expect(content).not.toContain('example.co.za');
    expect(content).toContain('Java');
    expect(content).toContain('Led a team of five engineers');
  });
});
