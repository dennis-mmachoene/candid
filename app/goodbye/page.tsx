import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = { title: 'Account deleted' };

export default function GoodbyePage() {
  return (
    <main className="flex flex-col items-center py-24 text-center">
      <Container width="narrow">
      <span className="border-accepted/30 bg-accepted/10 mb-6 grid size-14 place-items-center rounded-2xl border">
        <CheckCircle2 className="text-accepted size-7" aria-hidden />
      </span>

      <h1 className="text-fluid-2xl font-semibold tracking-tight text-balance">
        Everything has been deleted.
      </h1>
      <p className="text-muted-foreground mt-3 text-pretty">
        Your CVs, your tailored versions, your encrypted contact details and
        your account are gone. There was nothing held at the AI provider to
        remove.
      </p>

      <Card className="mt-8 w-full text-left">
        <CardContent className="text-muted-foreground pt-6 text-sm leading-relaxed">
          If you come back, you will start fresh: a new account, a new consent
          notice, and nothing carried over. That is not a limitation we could
          work around if we wanted to. There is nothing left to carry.
        </CardContent>
      </Card>

      <Button asChild variant="outline" className="mt-8">
        <Link href="/">Back to the start</Link>
      </Button>
    </Container>
    </main>
  );
}
