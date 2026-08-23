/**
 * Proof that exports are ATS-parseable — §9.
 *
 * The test that would be easy to write here is "the file was produced and has
 * bytes". That proves nothing. An applicant tracking system does not care that
 * a PDF exists; it cares whether it can read the candidate's name back out.
 *
 * So every export is rendered and then read back through the **same libraries
 * Candid ingests with** — `unpdf` for PDF, `mammoth` for DOCX. If the name,
 * the experience, the keywords and the section headings do not survive that
 * round trip, the export has failed at the one job it exists to do.
 *
 * The DOCX is additionally unzipped and its XML inspected directly, because
 * `mammoth` extracts text from a table perfectly happily. Asking mammoth
 * whether the document contains a table would always answer no.
 */

import JSZip from 'jszip';
import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';
import { describe, expect, it } from 'vitest';

import { deidentify } from '@/lib/domain/identity';
import { buildInventory } from '@/lib/domain/inventory';
import {
  ATS_SECTION_HEADINGS,
  TEMPLATES,
  assembleResumeDocument,
  validateAtsDocument,
} from '@/lib/domain/resume-document';
import { reviewDraft } from '@/lib/domain/validator';
import { renderDocx } from '@/lib/infrastructure/export/docx-renderer';
import { renderPdf } from '@/lib/infrastructure/export/pdf-renderer';
import { toPrintableText, wrapText } from '@/lib/infrastructure/export/text';
import type { ApprovedClaims, TailoredDraft } from '@/lib/domain/types';
import { CV_WITH_IDENTIFIERS } from './fixtures';

const { identity, content } = deidentify(CV_WITH_IDENTIFIERS);
const inventory = buildInventory(content);

const DRAFT: TailoredDraft = {
  summary:
    'Backend developer with six years building payment systems in Java and PostgreSQL for financial services.',
  positions: [
    {
      employer: 'Absa Bank',
      title: 'Senior Developer',
      startDate: '2020',
      endDate: 'present',
      bullets: [
        'Delivered a payments API in Java and PostgreSQL at Absa Bank',
        'Reduced settlement turnaround time by 40% through automating reconciliation',
        'Orchestrated container deployments with Kubernetes across three regions',
      ],
    },
  ],
  qualifications: [
    {
      award: 'BSc Computer Science',
      institution: 'University of Pretoria',
      year: '2017',
    },
  ],
  skills: ['Java', 'PostgreSQL', 'Docker', 'Kubernetes'],
  gaps: [{ skill: 'Kubernetes', note: 'The advert asks for it; your CV does not mention it.' }],
};

const report = reviewDraft(DRAFT, inventory);
const NOTHING_APPROVED: ApprovedClaims = new Set<string>();

const { document } = assembleResumeDocument({
  identity,
  draft: DRAFT,
  report,
  approved: NOTHING_APPROVED,
});

async function readPdf(bytes: Uint8Array): Promise<string> {
  const proxy = await getDocumentProxy(bytes);
  const { text } = await extractText(proxy, { mergePages: true });
  return text;
}

async function readDocx(bytes: Uint8Array): Promise<string> {
  const { value } = await mammoth.extractRawText({
    buffer: Buffer.from(bytes),
  });
  return value;
}

/** The raw `word/document.xml`, so structure can be inspected rather than inferred. */
async function readDocxXml(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(Buffer.from(bytes));
  const entry = zip.file('word/document.xml');
  expect(entry).not.toBeNull();
  return entry!.async('string');
}

/** Whitespace differs between renderers; content should not. */
function flatten(text: string): string {
  return text.replace(/\s+/g, ' ').toLowerCase();
}

describe('the document model itself', () => {
  it('passes the ATS check', () => {
    expect(validateAtsDocument(document)).toEqual([]);
  });

  it('uses conventional section headings', () => {
    const recognised = Object.values(ATS_SECTION_HEADINGS);
    for (const section of document.sections) {
      expect(recognised).toContain(section.heading);
    }
  });

  it('carries the identity that was withheld from the model', () => {
    expect(document.identity.fullName).toBe('Thabo Mokoena');
    expect(document.identity.email).toBe('thabo.mokoena@example.co.za');
  });
});

describe.each(TEMPLATES)('template: $name', (template) => {
  it('survives a PDF round trip', async () => {
    const bytes = await renderPdf(document, template);
    const text = flatten(await readPdf(bytes));

    // Identity, reattached on the server.
    expect(text).toContain('thabo mokoena');
    expect(text).toContain('thabo.mokoena@example.co.za');

    // Experience.
    expect(text).toContain('delivered a payments api');
    expect(text).toContain('reduced settlement turnaround time');

    // Keywords the advert would be matched on.
    expect(text).toContain('java');
    expect(text).toContain('postgresql');

    // Section headings, in whatever case the template applies.
    expect(text).toContain('experience');
    expect(text).toContain('skills');
  });

  it('survives a DOCX round trip', async () => {
    const bytes = await renderDocx(document, template);
    const text = flatten(await readDocx(bytes));

    expect(text).toContain('thabo mokoena');
    expect(text).toContain('thabo.mokoena@example.co.za');
    expect(text).toContain('delivered a payments api');
    expect(text).toContain('reduced settlement turnaround time');
    expect(text).toContain('java');
    expect(text).toContain('postgresql');
    expect(text).toContain('experience');
    expect(text).toContain('skills');
  });

  /**
   * The structural constraints of §9, checked against the XML rather than the
   * extracted text. Mammoth reads text out of a table perfectly well, so
   * asking it whether a table exists would always answer no.
   */
  it('produces a DOCX with no tables, images or text boxes', async () => {
    const xml = await readDocxXml(await renderDocx(document, template));

    expect(xml).not.toContain('<w:tbl');
    expect(xml).not.toContain('<w:drawing');
    expect(xml).not.toContain('<w:pict');
    expect(xml).not.toContain('<w:txbxContent');
    // A second column would break single-column parsing.
    expect(xml).not.toContain('<w:cols w:num="2"');
  });

  it('produces a DOCX with no headers or footers', async () => {
    const bytes = await renderDocx(document, template);
    const zip = await JSZip.loadAsync(Buffer.from(bytes));
    const parts = Object.keys(zip.files);

    expect(parts.filter((name) => /header\d*\.xml$/.test(name))).toEqual([]);
    expect(parts.filter((name) => /footer\d*\.xml$/.test(name))).toEqual([]);
    expect(parts.filter((name) => name.startsWith('word/media/'))).toEqual([]);
  });

  it('produces a PDF with selectable text rather than an image', async () => {
    const bytes = await renderPdf(document, template);
    const text = await readPdf(bytes);

    // A scanned or rasterised CV extracts to nothing. This is the same check
    // the uploader applies to reject scans.
    expect(text.length).toBeGreaterThan(200);
  });

  /**
   * The guarantee, at the last possible moment. Kubernetes is in the draft's
   * skills array and in a bullet, and it traces to nothing in the CV.
   */
  it('never writes a blocked claim into either file', async () => {
    const pdfText = flatten(await readPdf(await renderPdf(document, template)));
    const docxText = flatten(await readDocx(await renderDocx(document, template)));

    expect(pdfText).not.toContain('kubernetes');
    expect(docxText).not.toContain('kubernetes');
    expect(pdfText).not.toContain('orchestrated container deployments');
    expect(docxText).not.toContain('orchestrated container deployments');
  });

  /**
   * Gaps are for the candidate, not the employer. Telling a recruiter what you
   * cannot do is not the user's job.
   */
  it('never prints the gaps list', async () => {
    const pdfText = flatten(await readPdf(await renderPdf(document, template)));
    expect(pdfText).not.toContain('the advert asks for it');
    expect(pdfText).not.toContain('development areas');
  });
});

describe('templates change presentation only', () => {
  it('produces the same content from every template', async () => {
    const extracted = await Promise.all(
      TEMPLATES.map(async (template) =>
        flatten(await readPdf(await renderPdf(document, template))),
      ),
    );

    // Wrapping differs with font and size, so compare the words rather than
    // the layout. Identical word sequences from three different templates is
    // the property that matters: a template cannot change what is said.
    const words = extracted.map((text) => text.replace(/[^a-z0-9 ]/g, '').split(/\s+/).join(' '));
    for (const candidate of words.slice(1)) {
      expect(candidate).toBe(words[0]);
    }
  });

  it('does produce different file bytes, so the choice is not cosmetic theatre', async () => {
    const files = await Promise.all(
      TEMPLATES.map((template) => renderPdf(document, template)),
    );
    expect(files[0].byteLength).not.toBe(files[2].byteLength);
  });
});

describe('text preparation', () => {
  it('replaces characters a standard PDF font cannot encode', () => {
    const messy = '“Led” – a team’s … output here';
    const clean = toPrintableText(messy);

    expect(clean).toBe('"Led" - a team\'s ... output here');
  });

  it('keeps accented Latin characters, which South African names need', () => {
    expect(toPrintableText('Coetzée Naudé')).toBe('Coetzée Naudé');
  });

  it('wraps against a real measurement rather than a character count', () => {
    // 10 units per character.
    const measure = (line: string) => line.length * 10;
    const lines = wrapText('one two three four five', 100, measure);

    for (const line of lines) {
      expect(measure(line)).toBeLessThanOrEqual(100);
    }
    expect(lines.join(' ')).toBe('one two three four five');
  });

  it('breaks a single word too wide for the column', () => {
    const measure = (line: string) => line.length * 10;
    const lines = wrapText('supercalifragilistic', 50, measure);

    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(measure(line)).toBeLessThanOrEqual(50);
    }
    expect(lines.join('')).toBe('supercalifragilistic');
  });
});

/**
 * The assertion whose absence let the real defect ship.
 *
 * The suite already proved an export could be re-parsed. It could not fail on
 * a CV that had no employment history in it, because the fixture had none
 * either — so it was faithfully proving that a document with no employers, no
 * dates and no education survived a round trip. It did survive. It was also
 * useless to the person sending it.
 *
 * A recruiter reading bullets with no employer attached assumes concealment,
 * and an applicant tracking system cannot extract a work history from it at
 * all — which is the one thing this product exists to get past.
 */
describe.each(TEMPLATES)('a real CV survives: $name', (template) => {
  it('keeps the employer, the job title and both dates in the PDF', async () => {
    const text = flatten(await readPdf(await renderPdf(document, template)));

    expect(text).toContain('absa bank');
    expect(text).toContain('senior developer');
    expect(text).toContain('2020');
    expect(text).toContain('present');
  });

  it('keeps the employer, the job title and both dates in the DOCX', async () => {
    const text = flatten(await readDocx(await renderDocx(document, template)));

    expect(text).toContain('absa bank');
    expect(text).toContain('senior developer');
    expect(text).toContain('2020');
    expect(text).toContain('present');
  });

  it('keeps the qualification, under a heading a parser recognises', async () => {
    const pdf = flatten(await readPdf(await renderPdf(document, template)));
    const docx = flatten(await readDocx(await renderDocx(document, template)));

    for (const text of [pdf, docx]) {
      expect(text).toContain('education');
      expect(text).toContain('bsc computer science');
      expect(text).toContain('university of pretoria');
      expect(text).toContain('2017');
    }
  });
});
