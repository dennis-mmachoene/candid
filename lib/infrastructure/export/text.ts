import 'server-only';

/**
 * Text preparation shared by both renderers.
 *
 * PDF base-14 fonts encode WinAnsi, which is roughly Latin-1. A CV that came
 * out of a PDF parser routinely contains characters outside it — smart quotes,
 * various dashes, non-breaking spaces, the odd ligature — and handing one of
 * those to `drawText` throws rather than degrading. The export would fail on a
 * curly apostrophe.
 *
 * So both renderers run text through here first. The DOCX renderer does not
 * strictly need it, but using the same function on both is what keeps the two
 * outputs identical in content, which is the thing the round-trip test checks.
 */

const REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/[\u2018\u2019\u201A\u201B]/g, "'"],
  [/[\u201C\u201D\u201E\u201F]/g, '"'],
  [/[\u2013\u2014\u2015]/g, '-'],
  [/[\u2026]/g, '...'],
  [/[\u00A0\u2007\u202F]/g, ' '],
  [/[\u2022\u25CF\u25AA\u00B7]/g, '-'],
  [/[\u200B-\u200D\uFEFF]/g, ''],
  [/[\u2039]/g, '<'],
  [/[\u203A]/g, '>'],
  [/[\u2044]/g, '/'],
  [/[\uFB01]/g, 'fi'],
  [/[\uFB02]/g, 'fl'],
  [/[\u2122]/g, '(TM)'],
];

/**
 * Reduce text to characters a standard PDF font can encode.
 *
 * Accented Latin characters survive, because WinAnsi covers them and South
 * African names need them. Anything genuinely outside the encoding is dropped
 * rather than turned into a question mark: a stray glyph is worse than a
 * missing one on a document a recruiter will read.
 */
export function toPrintableText(input: string): string {
  let output = input;
  for (const [pattern, replacement] of REPLACEMENTS) {
    output = output.replace(pattern, replacement);
  }

  // Keep printable ASCII plus the Latin-1 supplement, drop the rest.
  return output
    .replace(/[^\u0020-\u007E\u00A1-\u00FF\n]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Greedy word wrap against a real measurement function.
 *
 * Takes `measure` rather than a character count because character counts are
 * wrong for proportional fonts, and being wrong here means text running off the
 * page edge in the finished PDF.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: (line: string) => number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (measure(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);

    // A single word wider than the column — a long URL, usually. Break it
    // rather than let it overflow the margin.
    if (measure(word) > maxWidth) {
      let chunk = '';
      for (const character of word) {
        if (measure(chunk + character) > maxWidth && chunk) {
          lines.push(chunk);
          chunk = character;
        } else {
          chunk += character;
        }
      }
      current = chunk;
    } else {
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}
