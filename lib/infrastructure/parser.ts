import 'server-only';

import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';

import type { CvFormat, CvParser, ParsedCv } from '@/lib/domain/ports';

/**
 * CV parsing, from magic bytes rather than from anything the browser said.
 *
 * `file.type` is supplied by the client and means nothing: it is trivially set
 * to `application/pdf` on a file that is not one. The extension means even
 * less. So the format is decided by reading the first few bytes, and a file
 * whose bytes do not match a format we support is rejected before any parsing
 * library is handed it.
 *
 * Everything here treats the upload as hostile. Both parsers are third-party
 * code processing an attacker-controlled binary, which is a category of thing
 * that has a long history of going wrong, so we bound the input first: size
 * cap, page cap, and extracted-text cap.
 */

export class UnsupportedFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedFileError';
  }
}

/** 5 MB. A CV that exceeds this is not a CV. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** Refuse to walk a 900-page PDF someone built to burn CPU. */
const MAX_PDF_PAGES = 30;
/** ~200k characters is far past any real CV; beyond it something is wrong. */
const MAX_EXTRACTED_CHARS = 200_000;

// --- Magic bytes -----------------------------------------------------------

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // "%PDF"
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // "PK\x03\x04" — every OOXML file
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0]; // legacy .doc / .xls

function startsWith(bytes: Uint8Array, magic: readonly number[]): boolean {
  if (bytes.length < magic.length) return false;
  return magic.every((byte, index) => bytes[index] === byte);
}

/**
 * A .docx is a ZIP, and so is a .xlsx, a .pptx, and a plain archive of
 * something unpleasant. The distinguishing feature is an entry named
 * `word/document.xml`, whose name appears as plain text in the ZIP central
 * directory. Checking for it rejects the neighbouring formats before mammoth
 * is asked to make sense of them.
 */
function looksLikeDocx(bytes: Uint8Array): boolean {
  const haystack = Buffer.from(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).toString('latin1');
  return haystack.includes('word/document.xml');
}

export function detectFormat(bytes: Uint8Array): CvFormat {
  if (startsWith(bytes, PDF_MAGIC)) return 'pdf';

  if (startsWith(bytes, ZIP_MAGIC)) {
    if (looksLikeDocx(bytes)) return 'docx';
    throw new UnsupportedFileError(
      'That looks like a zipped file, but not a Word document. Please upload a PDF or a .docx CV.',
    );
  }

  if (startsWith(bytes, OLE_MAGIC)) {
    throw new UnsupportedFileError(
      'That is an old-format Word file (.doc). Please open it in Word and save it as .docx, then upload again.',
    );
  }

  throw new UnsupportedFileError(
    'That file is not a PDF or a Word document. Please upload a PDF or a .docx CV.',
  );
}

// --- Parsing ---------------------------------------------------------------

function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    // Non-breaking and zero-width characters survive PDF extraction and then
    // break every regex downstream, including the ID-number match.
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function parsePdf(bytes: Uint8Array): Promise<string> {
  const document = await getDocumentProxy(bytes);

  if (document.numPages > MAX_PDF_PAGES) {
    throw new UnsupportedFileError(
      `That PDF has ${document.numPages} pages. Please upload a CV of ${MAX_PDF_PAGES} pages or fewer.`,
    );
  }

  const { text } = await extractText(document, { mergePages: true });
  return text;
}

async function parseDocx(bytes: Uint8Array): Promise<string> {
  const { value } = await mammoth.extractRawText({
    buffer: Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength),
  });
  return value;
}

export class FileCvParser implements CvParser {
  async parse(bytes: Uint8Array): Promise<ParsedCv> {
    if (bytes.byteLength === 0) {
      throw new UnsupportedFileError('That file is empty.');
    }
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      throw new UnsupportedFileError(
        `That file is larger than ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB. Please upload a smaller CV.`,
      );
    }

    const format = detectFormat(bytes);

    let raw: string;
    try {
      raw = format === 'pdf' ? await parsePdf(bytes) : await parseDocx(bytes);
    } catch (error) {
      if (error instanceof UnsupportedFileError) throw error;
      // Whatever the library said about its internals is not the user's
      // problem and may describe our stack. Log it upstream; say this.
      throw new UnsupportedFileError(
        'That file could not be read. It may be corrupted or password-protected.',
      );
    }

    const text = tidy(raw).slice(0, MAX_EXTRACTED_CHARS);

    if (text.length < 50) {
      // Almost always a scanned CV: a picture of a page, with no text layer.
      throw new UnsupportedFileError(
        'No readable text was found. If your CV is a scan or a photo, please upload a version with selectable text.',
      );
    }

    return { format, text };
  }
}

export const cvParser: CvParser = new FileCvParser();
