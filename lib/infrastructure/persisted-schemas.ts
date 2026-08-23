import 'server-only';

import { z } from 'zod';

import type { Json } from '@/lib/database.types';
import type { IntegrityReport, TailoredDraft } from '@/lib/domain/types';

/**
 * Validation for the `jsonb` columns, on the way back out.
 *
 * This file exists because typing the database surfaced something that had been
 * invisible: every read of `draft` and `report` was an unchecked cast from
 * `Json` to a domain type. The compiler had been silent about it only because
 * the client returned `any`.
 *
 * That is a real gap, not a typing inconvenience. A malformed row — written by
 * an older version of the code, restored from a backup, or edited by hand in
 * the Supabase table editor — would flow into the document assembler and fail
 * somewhere far from the cause. Worse, an `IntegrityReport` missing its
 * `blocked` array would read as "nothing was blocked".
 *
 * So data coming out of the database is validated exactly as data coming out of
 * the model is. Same principle, same boundary discipline: nothing crosses into
 * the domain unchecked, wherever it came from.
 */

const skillEvidenceSchema = z.object({
  surface: z.string(),
  line: z.string(),
});

/**
 * The enums are supersets of what older records can contain, deliberately.
 *
 * A record written before structured employment history carries `kind` from
 * three values and `source` from three. Widening rather than replacing means
 * those rows still parse. Narrowing would have turned every stored tailoring
 * into a corrupt-record error the moment the new shape shipped.
 */
const claimSchema = z.object({
  text: z.string(),
  kind: z.enum(['skill', 'employer', 'date', 'institution']),
  source: z.enum(['skill', 'bullet', 'summary', 'position', 'education']),
  positionIndex: z.number().int().nonnegative().optional(),
  bulletIndex: z.number().int().nonnegative().optional(),
  qualificationIndex: z.number().int().nonnegative().optional(),
});

const validatedClaimSchema = z.object({
  claim: claimSchema,
  verdict: z.enum(['accepted', 'borderline', 'blocked']),
  canonical: z.string(),
  reason: z.string(),
  evidence: z.array(skillEvidenceSchema),
});

const gapSchema = z.object({ skill: z.string(), note: z.string() });

const positionSchema = z.object({
  employer: z.string(),
  title: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  bullets: z.array(z.string()),
  legacy: z.literal(true).optional(),
});

const qualificationSchema = z.object({
  award: z.string(),
  institution: z.string(),
  year: z.string(),
});

/** What the current code writes. */
const currentDraftSchema = z.object({
  summary: z.string(),
  positions: z.array(positionSchema),
  qualifications: z.array(qualificationSchema),
  skills: z.array(z.string()),
  gaps: z.array(gapSchema),
});

/**
 * What every row written before structured employment history looks like: a
 * summary, a flat list of bullets belonging to nobody, skills and gaps.
 */
const legacyDraftSchema = z.object({
  summary: z.string(),
  bullets: z.array(z.string()),
  skills: z.array(z.string()),
  gaps: z.array(gapSchema),
});

/**
 * Read either shape, and map the old one forward in memory.
 *
 * The two are unambiguous — a current record has no `bullets` key and a legacy
 * one has no `positions` — so the union cannot pick the wrong branch.
 *
 * The old bullets become one position with no employer, no title and no dates,
 * marked `legacy`. The record opens and shows exactly what it showed before.
 *
 * Nothing is rewritten in the database, and that is the deliberate part. A
 * migration would have to put *something* in those employer fields, and the
 * information to put there does not exist — it was never stored. Writing a
 * plausible employer into a user's history, in a product whose whole claim is
 * that it does not invent things, is not a trade worth making for tidier rows.
 */
export const persistedDraftSchema: z.ZodType<TailoredDraft> = z.union([
  currentDraftSchema,
  legacyDraftSchema.transform(
    (old): TailoredDraft => ({
      summary: old.summary,
      positions:
        old.bullets.length > 0
          ? [
              {
                employer: '',
                title: '',
                startDate: '',
                endDate: '',
                bullets: old.bullets,
                legacy: true,
              },
            ]
          : [],
      qualifications: [],
      skills: old.skills,
      gaps: old.gaps,
    }),
  ),
]);

export const persistedReportSchema = z.object({
  accepted: z.array(validatedClaimSchema),
  borderline: z.array(validatedClaimSchema),
  blocked: z.array(validatedClaimSchema),
});

export const persistedApprovalsSchema = z.array(z.string());

export class CorruptRecordError extends Error {
  constructor(what: string) {
    super(
      `A stored ${what} could not be read. It may have been written by an older version of Candid.`,
    );
    this.name = 'CorruptRecordError';
  }
}

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, what: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    // Shape only. The value is derived from the user's CV.
    console.error(
      `[repo] stored ${what} failed validation`,
      result.error.issues.map((issue) => ({
        code: issue.code,
        path: issue.path.join('.'),
      })),
    );
    throw new CorruptRecordError(what);
  }
  return result.data;
}

export function readDraft(value: Json): TailoredDraft {
  return parseOrThrow(persistedDraftSchema, value, 'draft');
}

/**
 * Note the failure mode this prevents. A report missing its `blocked` array
 * would parse as `{ accepted: [...], borderline: [...] }` under a cast, and
 * `report.blocked` would be `undefined`. `assembleResumeDocument` spreads all
 * three arrays, so that would throw — but a slightly different shape could
 * instead read as "nothing was blocked", and a fabricated claim would have no
 * record refusing it. Requiring all three fields closes that.
 */
export function readReport(value: Json): IntegrityReport {
  return parseOrThrow(persistedReportSchema, value, 'integrity report');
}

export function readApprovals(value: Json): string[] {
  // An absent or malformed approvals list means "nothing approved", which is
  // the safe reading: it can only ever exclude content, never include it.
  const result = persistedApprovalsSchema.safeParse(value);
  return result.success ? result.data : [];
}

/**
 * Domain objects use `readonly` arrays; the generated `Json` type does not.
 * A structured clone through JSON is the honest conversion — it also guarantees
 * what is written is genuinely serialisable, rather than something carrying a
 * `Date` or a `Set` that would land in the column as `{}`.
 */
export function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}
