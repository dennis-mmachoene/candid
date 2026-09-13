import { createReadStream } from 'node:fs';
import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'csv-parse';

/**
 * Loading the public datasets Candid is evaluated against.
 *
 * Two sets, both CC0 public domain, both downloaded from Kaggle and both kept
 * outside the repository. They are large, they are not ours to redistribute,
 * and nothing in the application reads them. Only this harness does.
 *
 *   Resume Dataset      snehaanbhawal/resume-dataset
 *                       2484 resumes as PDFs, plus a CSV of the same resumes
 *                       as plain text, grouped into 24 job categories.
 *
 *   Job Description     ravindrasinghrana/job-description-dataset
 *                       Job adverts with title, description, required skills,
 *                       responsibilities and qualifications.
 *
 * Both are streamed rather than read whole. The job advert file is over 450 MB
 * and the harness never needs more than a few hundred rows of it.
 */

/**
 * Where the extracted datasets live.
 *
 * Defaults to a `Datasets` folder beside the repository, which is where they
 * land if you extract the Kaggle downloads in place. Override with
 * CANDID_DATASET_DIR if yours are somewhere else.
 */
export const DATASET_ROOT =
  process.env.CANDID_DATASET_DIR ??
  path.resolve(process.cwd(), '..', 'Datasets');

const RESUME_DIR = 'Resume Dataset (snehaanbhawal)';
const JOBS_DIR = 'Job Description Dataset (ravindrasinghrana)';

export const PATHS = {
  resumeCsv: path.join(DATASET_ROOT, RESUME_DIR, 'Resume', 'Resume.csv'),
  resumePdfRoot: path.join(DATASET_ROOT, RESUME_DIR, 'data', 'data'),
  jobsCsv: path.join(DATASET_ROOT, JOBS_DIR, 'job_descriptions.csv'),
} as const;

/**
 * Fail with a sentence that says what to do, not just what is missing.
 *
 * The harness is run by hand, often months after the data was downloaded, and
 * "ENOENT" tells nobody anything.
 */
export async function requireDataset(file: string): Promise<void> {
  try {
    await access(file);
  } catch {
    throw new Error(
      `Dataset file not found:\n  ${file}\n\n` +
        `Expected the Kaggle downloads extracted under:\n  ${DATASET_ROOT}\n\n` +
        `Set CANDID_DATASET_DIR if they live elsewhere. See evaluation/README.md.`,
    );
  }
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/**
 * Read up to `limit` rows from a CSV, streaming.
 *
 * `relax_quotes` and `relax_column_count` are deliberate. These are scraped
 * public datasets with ragged rows and stray quotes in them; refusing the whole
 * file over one malformed record would be the wrong trade for an evaluation
 * harness. Rows that cannot be parsed are skipped and counted, never guessed at.
 */
async function readCsvRows(
  file: string,
  limit: number,
): Promise<Record<string, string>[]> {
  await requireDataset(file);

  const rows: Record<string, string>[] = [];
  const parser = createReadStream(file).pipe(
    parse({
      columns: true,
      relax_quotes: true,
      relax_column_count: true,
      skip_records_with_error: true,
      bom: true,
    }),
  );

  for await (const row of parser) {
    rows.push(row as Record<string, string>);
    if (rows.length >= limit) break;
  }

  // Breaking out of the loop above leaves the underlying file handle open.
  parser.destroy();
  return rows;
}

// ---------------------------------------------------------------------------
// Resumes
// ---------------------------------------------------------------------------

export interface ResumeRecord {
  id: string;
  category: string;
  /** The resume as plain text, which is what the CSV calls Resume_str. */
  text: string;
}

/**
 * Resumes as text. Used for the measurements that do not need a real file:
 * de-identification, identity-number detection and tailoring.
 */
export async function loadResumeText(limit: number): Promise<ResumeRecord[]> {
  const rows = await readCsvRows(PATHS.resumeCsv, limit);

  return rows
    .map((row) => ({
      id: String(row.ID ?? '').trim(),
      category: String(row.Category ?? '').trim(),
      text: String(row.Resume_str ?? ''),
    }))
    .filter((record) => record.text.trim().length > 0);
}

export interface ResumePdf {
  id: string;
  category: string;
  file: string;
}

/**
 * The PDF files themselves, which is the only thing that can exercise the
 * parser end to end. Magic-byte detection cannot be tested against a column of
 * text, because a column of text is not a file.
 *
 * Files are interleaved across categories rather than taken in directory order,
 * so a sample of 300 covers all 24 professions instead of stopping somewhere
 * inside ACCOUNTANT.
 */
export async function listResumePdfs(limit: number): Promise<ResumePdf[]> {
  await requireDataset(PATHS.resumePdfRoot);

  const categories = (
    await readdir(PATHS.resumePdfRoot, { withFileTypes: true })
  )
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const byCategory: ResumePdf[][] = [];
  for (const category of categories) {
    const directory = path.join(PATHS.resumePdfRoot, category);
    const files = (await readdir(directory))
      .filter((name) => name.toLowerCase().endsWith('.pdf'))
      .sort();

    byCategory.push(
      files.map((name) => ({
        id: path.basename(name, path.extname(name)),
        category,
        file: path.join(directory, name),
      })),
    );
  }

  const interleaved: ResumePdf[] = [];
  const deepest = Math.max(0, ...byCategory.map((files) => files.length));

  for (let index = 0; index < deepest; index += 1) {
    for (const files of byCategory) {
      const file = files[index];
      if (file) interleaved.push(file);
      if (interleaved.length >= limit) return interleaved;
    }
  }

  return interleaved;
}

// ---------------------------------------------------------------------------
// Job adverts
// ---------------------------------------------------------------------------

export interface JobAdvert {
  id: string;
  title: string;
  text: string;
}

/**
 * Build an advert out of the columns that describe the role.
 *
 * The dataset carries salary, latitude, a contact person's telephone number and
 * a gender preference field. None of that belongs in what a candidate pastes,
 * and the last one has no business anywhere near a hiring tool, so only the
 * five role columns are used.
 *
 * The shape mirrors a real advert on purpose: title, description, then the
 * requirements list. Candid's own guidance tells users to include the
 * requirements list, because that is what the CV is matched against.
 */
export function composeAdvert(row: Record<string, string>): string {
  const section = (heading: string, body: string): string =>
    body.trim() ? `${heading}\n${body.trim()}` : '';

  return [
    String(row['Job Title'] ?? 'Role').trim(),
    '',
    String(row['Job Description'] ?? '').trim(),
    '',
    section('Requirements:', String(row.skills ?? '')),
    '',
    section('Responsibilities:', String(row.Responsibilities ?? '')),
    '',
    section('Qualifications:', String(row.Qualifications ?? '')),
  ]
    .filter((part) => part !== '')
    .join('\n')
    .trim();
}

/**
 * Adverts long enough to be worth tailoring against.
 *
 * Candid's own form refuses anything under 80 characters, on the grounds that a
 * two-line advert gives a worse result. The harness applies the same floor, so
 * the evaluation measures the product as users meet it.
 */
export async function loadJobAdverts(limit: number): Promise<JobAdvert[]> {
  // Over-read, because short rows are discarded below.
  const rows = await readCsvRows(PATHS.jobsCsv, limit * 3);

  const adverts: JobAdvert[] = [];
  for (const row of rows) {
    const text = composeAdvert(row);
    if (text.length < 80) continue;

    adverts.push({
      id: String(row['Job Id'] ?? adverts.length).trim(),
      title: String(row['Job Title'] ?? 'Role').trim(),
      // Candid caps the advert at 15 000 characters before it reaches the
      // model. Trimming here keeps the harness honest about what was sent.
      text: text.slice(0, 15_000),
    });

    if (adverts.length >= limit) break;
  }

  return adverts;
}
