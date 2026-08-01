import Link from 'next/link';
import { ArrowRight, Ban, Check, CircleAlert, Clock, History } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { requireConsentedUser } from '@/lib/dal';
import { RETENTION_MONTHS } from '@/lib/domain/consent';
import { resumeRepository } from '@/lib/infrastructure/supabase-repo';

export const metadata = { title: 'History' };

const STATUS_LABEL: Record<string, string> = {
  review: 'Awaiting your review',
  approved: 'Reviewed',
  exported: 'Downloaded',
  blocked: 'Nothing survived validation',
};

export default async function HistoryPage() {
  const user = await requireConsentedUser();

  // RLS-scoped. No user id is passed, because accepting one would invite
  // passing somebody else's.
  const tailorings = await resumeRepository.listTailorings();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="animate-rise flex flex-col gap-2">
        <Badge variant="brand">
          <History className="size-3" aria-hidden />
          History
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {user.firstName}&apos;s tailored CVs
        </h1>
        <p className="text-muted-foreground">
          Every version Candid has produced for you, and what it refused each
          time.
        </p>
      </header>

      {tailorings.length === 0 ? (
        <Card className="mt-10 border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Clock className="text-muted-foreground/50 size-8" aria-hidden />
            <p className="font-medium">Nothing tailored yet</p>
            <p className="text-muted-foreground max-w-sm text-sm">
              Upload a CV and tailor it against a job advert. Each version will
              appear here.
            </p>
            <Button asChild className="mt-2">
              <Link href="/dashboard">Go to your CVs</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-10 flex flex-col gap-4">
          {tailorings.map((item) => (
            <li key={item.id}>
              <Card className="card-hover">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <CardTitle className="text-base">
                      {item.title ?? 'Untitled role'}
                    </CardTitle>
                    <Badge
                      variant={
                        item.status === 'blocked'
                          ? 'blocked'
                          : item.status === 'exported'
                            ? 'accepted'
                            : 'secondary'
                      }
                    >
                      {STATUS_LABEL[item.status] ?? item.status}
                    </Badge>
                  </div>
                  <CardDescription>
                    {item.createdAt.toLocaleDateString('en-ZA', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex flex-col gap-4">
                  {item.advertExcerpt ? (
                    <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
                      {item.advertExcerpt}
                      {item.advertExcerpt.length >= 160 ? '…' : ''}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="accepted">
                      <Check className="size-3" aria-hidden />
                      {item.acceptedCount} traced
                    </Badge>
                    <Badge variant="borderline">
                      <CircleAlert className="size-3" aria-hidden />
                      {item.borderlineCount} your call
                      {item.approvedCount > 0
                        ? `, ${item.approvedCount} approved`
                        : ''}
                    </Badge>
                    <Badge variant="blocked">
                      <Ban className="size-3" aria-hidden />
                      {item.blockedCount} refused
                    </Badge>
                    {item.gapCount > 0 ? (
                      <Badge variant="outline">{item.gapCount} gaps</Badge>
                    ) : null}
                  </div>

                  <Button asChild size="sm" variant="outline" className="self-start">
                    <Link href={`/review/${item.id}`}>
                      Open
                      <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="text-muted-foreground mt-10 text-xs leading-relaxed">
        A CV you have not used for {RETENTION_MONTHS} months is deleted
        automatically, along with everything tailored from it. Tailoring or
        downloading resets that clock. You can also delete everything now from{' '}
        <Link href="/settings" className="underline underline-offset-4">
          settings
        </Link>
        .
      </p>
    </main>
  );
}
