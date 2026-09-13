import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Writing results down.
 *
 * A number read off a terminal and typed into a document is a number nobody can
 * check. Every measurement here is written to disk as JSON, so the figure that
 * appears in the documentation can be traced back to the run that produced it,
 * and re-run.
 *
 * A Markdown copy is written beside it because that is the form the numbers are
 * quoted in, and retyping a table is how a table drifts from its source.
 */

const RESULTS_DIR = path.resolve(process.cwd(), 'evaluation', 'results');

export interface Measurement {
  /** Short identifier, e.g. "parser". Becomes the file name. */
  key: string;
  title: string;
  /** One sentence on what this measures and why it matters. */
  question: string;
  /** The headline figures, in the order they should be read. */
  figures: Record<string, string | number>;
  /** Anything worth eyeballing: sample values, failure reasons, outliers. */
  detail?: Record<string, unknown>;
}

function formatTable(figures: Record<string, string | number>): string {
  const rows = Object.entries(figures);
  const width = Math.max(...rows.map(([label]) => label.length));

  return rows
    .map(([label, value]) => `  ${label.padEnd(width)}  ${value}`)
    .join('\n');
}

/** Print to the terminal, where someone is watching it run. */
export function printMeasurement(measurement: Measurement): void {
  const rule = '-'.repeat(Math.max(40, measurement.title.length + 4));

  console.log(`\n${rule}`);
  console.log(`  ${measurement.title}`);
  console.log(rule);
  console.log(`  ${measurement.question}\n`);
  console.log(formatTable(measurement.figures));
  console.log('');
}

/**
 * Persist one measurement, as JSON and as a Markdown fragment.
 *
 * The run is stamped with the time and the commit is not recorded here on
 * purpose: the harness has no business shelling out to git, and the result is
 * meaningless without the working tree anyway. Record the commit yourself when
 * you quote the figure.
 */
export async function saveMeasurement(
  measurement: Measurement,
): Promise<string> {
  await mkdir(RESULTS_DIR, { recursive: true });

  const runAt = new Date().toISOString();
  const payload = { ...measurement, runAt };

  const jsonPath = path.join(RESULTS_DIR, `${measurement.key}.json`);
  await writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const markdown = [
    `### ${measurement.title}`,
    '',
    measurement.question,
    '',
    '| Measure | Value |',
    '|---|---|',
    ...Object.entries(measurement.figures).map(
      ([label, value]) => `| ${label} | ${value} |`,
    ),
    '',
    `Measured ${runAt}.`,
    '',
  ].join('\n');

  const markdownPath = path.join(RESULTS_DIR, `${measurement.key}.md`);
  await writeFile(markdownPath, markdown, 'utf8');

  return jsonPath;
}

/** Two decimal places, as a percentage string. */
export function percent(part: number, whole: number): string {
  if (whole === 0) return 'n/a';
  return `${((part / whole) * 100).toFixed(2)}%`;
}

/** Progress on one line, so a twenty-minute run does not look like a hang. */
export function progress(label: string, done: number, total: number): void {
  if (done % 50 !== 0 && done !== total) return;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  console.log(`  ${label}: ${done}/${total} (${pct}%)`);
}
