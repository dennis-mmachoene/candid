import 'server-only';

import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
  convertInchesToTwip,
} from 'docx';

import { toPrintableText } from './text';
import type { TemplateSpec } from '@/lib/domain/resume-document';
import type { IdentityHeader, ResumeDocument } from '@/lib/domain/types';

/**
 * DOCX export.
 *
 * Same neutral document model as the PDF renderer, same constraints. What is
 * absent matters more than what is present:
 *
 *   - **No `Table`, `ImageRun`, `Header`, `Footer` or `TextBox` import.** The
 *     `docx` library offers all of them. None is imported here, so none can be
 *     emitted, and the round-trip test asserts the generated XML contains no
 *     `w:tbl` or `w:drawing` element.
 *   - **One section, one column.** `columns` is never configured, so the
 *     default single column applies.
 *   - **Real headings, as bold paragraphs.** Not `HeadingLevel`, deliberately —
 *     see the note on `sectionHeading` below.
 *   - **Bullets as literal hyphen text**, matching the PDF. Word's numbering
 *     definitions are a common cause of an ATS reading back a list as one
 *     unbroken paragraph.
 *
 * Everything the template controls is typography and spacing. There is no
 * template field that could change structure.
 */

/** docx measures in half-points; the spec is in points. */
function halfPoints(points: number): number {
  return Math.round(points * 2);
}

/** And in twips for spacing: 20 twips to a point. */
function twips(points: number): number {
  return Math.round(points * 20);
}

function fontName(template: TemplateSpec): string {
  switch (template.fontFamily) {
    case 'Times-Roman':
      return 'Times New Roman';
    case 'Courier':
      return 'Courier New';
    default:
      return 'Arial';
  }
}

function contactLine(identity: IdentityHeader): string {
  return [identity.email, identity.phone]
    .filter((part): part is string => Boolean(part))
    .join('  |  ');
}

export async function renderDocx(
  document: ResumeDocument,
  template: TemplateSpec,
): Promise<Uint8Array> {
  const font = fontName(template);
  const base = halfPoints(template.baseFontSize);
  const children: Paragraph[] = [];

  const paragraph = (
    text: string,
    options: {
      size: number;
      bold?: boolean;
      spacingBefore?: number;
      spacingAfter?: number;
      indent?: boolean;
    },
  ): Paragraph =>
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: {
        before: twips(options.spacingBefore ?? 0),
        after: twips(options.spacingAfter ?? 2),
        line: Math.round(240 * template.lineSpacing),
      },
      indent: options.indent
        ? { left: convertInchesToTwip(0.25), hanging: convertInchesToTwip(0.15) }
        : undefined,
      children: [
        new TextRun({
          text: toPrintableText(text),
          bold: options.bold ?? false,
          font,
          size: options.size,
        }),
      ],
    });

  // --- Identity, reattached ------------------------------------------------
  if (document.identity.fullName) {
    children.push(
      paragraph(document.identity.fullName, {
        size: halfPoints(template.nameFontSize),
        bold: true,
        spacingAfter: 2,
      }),
    );
  }

  const contact = contactLine(document.identity);
  if (contact) {
    children.push(paragraph(contact, { size: base, spacingAfter: 6 }));
  }

  // --- Sections ------------------------------------------------------------
  for (const section of document.sections) {
    /*
     * A bold paragraph rather than `HeadingLevel.HEADING_1`.
     *
     * Word's built-in heading styles carry a style id that some applicant
     * tracking systems strip along with the text, and others read as document
     * metadata rather than as a section label. A plain bold paragraph
     * containing the literal words "Professional Summary" is read back
     * correctly by every parser we ingest with, which is the bar that matters
     * here. It looks identical to a human.
     */
    children.push(
      paragraph(
        template.headingTransform === 'uppercase'
          ? section.heading.toUpperCase()
          : section.heading,
        {
          size: halfPoints(template.headingFontSize),
          bold: true,
          spacingBefore: template.sectionSpacing,
          spacingAfter: 3,
        },
      ),
    );

    for (const block of section.blocks) {
      if (block.kind === 'paragraph') {
        children.push(paragraph(block.text, { size: base }));
      } else {
        for (const item of block.items) {
          children.push(
            paragraph(`- ${item}`, { size: base, indent: true, spacingAfter: 1 }),
          );
        }
      }
    }
  }

  const file = new Document({
    creator: 'Candid',
    title: 'Curriculum Vitae',
    styles: {
      default: {
        document: {
          run: { font, size: base },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: twips(template.marginPoints),
              bottom: twips(template.marginPoints),
              left: twips(template.marginPoints),
              right: twips(template.marginPoints),
            },
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(file);
  return new Uint8Array(buffer);
}
