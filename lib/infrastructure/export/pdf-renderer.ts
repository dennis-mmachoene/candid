import 'server-only';

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

import { toPrintableText, wrapText } from './text';
import type { TemplateSpec } from '@/lib/domain/resume-document';
import type { IdentityHeader, ResumeDocument } from '@/lib/domain/types';

/**
 * PDF export.
 *
 * §9 of the spec is a list of constraints, not preferences, and most of them
 * are satisfied by what this file never does rather than by what it does:
 *
 *   - **Single column.** There is one `x` origin and one text cursor. No code
 *     path here can produce a second column.
 *   - **No tables, text boxes, headers, footers or images.** `pdf-lib` can draw
 *     all of them. Nothing here calls those methods, and the document model has
 *     no way to express them, so a future change would have to add both.
 *   - **Real selectable text in standard fonts.** Base-14 fonts, drawn with
 *     `drawText`. Nothing is rasterised. An ATS reading this back gets
 *     characters, not pixels.
 *   - **Conventional headings.** Supplied by the document model.
 *
 * The template controls typography and spacing only. There is no template field
 * capable of changing structure, which is what stops "a nicer design" from
 * quietly becoming an unparseable one.
 */

// A4, in points.
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.35, 0.35, 0.4);

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

function fontNames(template: TemplateSpec): {
  regular: StandardFonts;
  bold: StandardFonts;
} {
  switch (template.fontFamily) {
    case 'Times-Roman':
      return { regular: StandardFonts.TimesRoman, bold: StandardFonts.TimesRomanBold };
    case 'Courier':
      return { regular: StandardFonts.Courier, bold: StandardFonts.CourierBold };
    default:
      return { regular: StandardFonts.Helvetica, bold: StandardFonts.HelveticaBold };
  }
}

function headingText(heading: string, template: TemplateSpec): string {
  return template.headingTransform === 'uppercase'
    ? heading.toUpperCase()
    : heading;
}

/** The identity line: name, then contact details on one row beneath it. */
function contactLine(identity: IdentityHeader): string {
  return [identity.email, identity.phone]
    .filter((part): part is string => Boolean(part))
    .join('  |  ');
}

/**
 * A cursor that knows how to start a new page.
 *
 * Written as a small state machine rather than laid out in one pass because a
 * CV that runs to two pages must not have a section heading orphaned at the
 * bottom of the first one.
 */
class Layout {
  private page: PDFPage;
  private y: number;

  constructor(
    private readonly document: PDFDocument,
    private readonly template: TemplateSpec,
    private readonly fonts: Fonts,
  ) {
    this.page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - template.marginPoints;
  }

  private get contentWidth(): number {
    return PAGE_WIDTH - this.template.marginPoints * 2;
  }

  private ensure(space: number): void {
    if (this.y - space >= this.template.marginPoints) return;
    this.page = this.document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - this.template.marginPoints;
  }

  gap(points: number): void {
    this.y -= points;
  }

  line(
    text: string,
    options: {
      size: number;
      bold?: boolean;
      colour?: ReturnType<typeof rgb>;
      indent?: number;
    },
  ): void {
    const font = options.bold ? this.fonts.bold : this.fonts.regular;
    const lineHeight = options.size * this.template.lineSpacing;
    const indent = options.indent ?? 0;
    const width = this.contentWidth - indent;

    const wrapped = wrapText(toPrintableText(text), width, (candidate) =>
      font.widthOfTextAtSize(candidate, options.size),
    );

    for (const wrappedLine of wrapped) {
      this.ensure(lineHeight);
      this.page.drawText(wrappedLine, {
        x: this.template.marginPoints + indent,
        y: this.y - options.size,
        size: options.size,
        font,
        color: options.colour ?? INK,
      });
      this.y -= lineHeight;
    }
  }

  /**
   * Keep a heading with at least one line of what follows it. Without this a
   * two-page CV can end with "Skills" alone at the foot of page one, which
   * reads as an error to a human and parses oddly for a machine.
   */
  heading(text: string): void {
    const size = this.template.headingFontSize;
    this.ensure(size * this.template.lineSpacing * 2.5);
    this.line(headingText(text, this.template), { size, bold: true });
    this.gap(2);
  }

  bullet(text: string): void {
    const size = this.template.baseFontSize;
    const marker = '- ';
    const markerWidth = this.fonts.regular.widthOfTextAtSize(marker, size);

    // The marker is a real hyphen and a real space, drawn as text. Word
    // processors and parsers both read that back as a list. A drawn glyph or a
    // tab-aligned indent would not survive extraction.
    this.ensure(size * this.template.lineSpacing);
    this.page.drawText(marker, {
      x: this.template.marginPoints,
      y: this.y - size,
      size,
      font: this.fonts.regular,
      color: INK,
    });

    this.line(text, { size, indent: markerWidth });
  }
}

export async function renderPdf(
  document: ResumeDocument,
  template: TemplateSpec,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Curriculum Vitae');
  pdf.setProducer('Candid');
  pdf.setCreator('Candid');

  const names = fontNames(template);
  const fonts: Fonts = {
    regular: await pdf.embedFont(names.regular),
    bold: await pdf.embedFont(names.bold),
  };

  const layout = new Layout(pdf, template, fonts);

  // --- Identity, reattached ------------------------------------------------
  if (document.identity.fullName) {
    layout.line(document.identity.fullName, {
      size: template.nameFontSize,
      bold: true,
    });
    layout.gap(2);
  }

  const contact = contactLine(document.identity);
  if (contact) {
    layout.line(contact, { size: template.baseFontSize, colour: MUTED });
  }

  // --- Sections ------------------------------------------------------------
  for (const section of document.sections) {
    layout.gap(template.sectionSpacing);
    layout.heading(section.heading);

    for (const block of section.blocks) {
      if (block.kind === 'paragraph') {
        layout.line(block.text, { size: template.baseFontSize });
      } else if (block.kind === 'entry') {
        // The job or qualification line. Bold and nothing else — no right-
        // aligned dates, no rule, no two-column split. Bold is the one piece of
        // formatting an applicant tracking system reads reliably, and the
        // designer's version of this line is what makes a CV unparseable.
        layout.gap(template.sectionSpacing / 3);
        layout.line(block.text, { size: template.baseFontSize, bold: true });
      } else {
        for (const item of block.items) {
          layout.bullet(item);
        }
      }
    }
  }

  return pdf.save();
}
