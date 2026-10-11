import { Bookmark, BookmarkCheck } from 'lucide-react';

import { toggleSavedJob } from '@/app/actions/saved';
import { Button } from '@/components/ui/button';

/**
 * Save or unsave a role.
 *
 * A Server Component, with no `'use client'` and no state. The form posts to a
 * Server Action, the page revalidates, and the button comes back in its other
 * position. That means no JavaScript is shipped for it and it works with
 * JavaScript off, which for a button this simple is strictly better than a
 * client component holding an optimistic flag.
 *
 * The cost is honest and worth naming: there is no instant flip. The icon
 * changes when the server answers, which on a slow connection is a moment of
 * nothing happening. An optimistic update would need this to become a client
 * component, and a shortlist that briefly lies about what is in it is a worse
 * trade than a button that is briefly slow.
 *
 * `aria-pressed` rather than a label that changes meaning. A screen reader
 * announces the toggle and its state, instead of reading "Save" on a role that
 * is already saved.
 */
export function SaveJobButton({
  jobId,
  saved,
  withLabel = false,
}: {
  jobId: string;
  saved: boolean;
  /** Show the word as well as the icon. The job page has room; a card does not. */
  withLabel?: boolean;
}) {
  return (
    <form action={toggleSavedJob}>
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="saved" value={String(saved)} />
      <Button
        type="submit"
        variant={saved ? 'secondary' : 'ghost'}
        size={withLabel ? 'default' : 'icon'}
        aria-pressed={saved}
        aria-label={saved ? 'Remove from your shortlist' : 'Save to your shortlist'}
        title={saved ? 'Saved' : 'Save'}
      >
        {saved ? (
          <BookmarkCheck className="text-brand-700 dark:text-brand-300 size-4" aria-hidden />
        ) : (
          <Bookmark className="size-4" aria-hidden />
        )}
        {withLabel ? (saved ? 'Saved' : 'Save') : null}
      </Button>
    </form>
  );
}
