import { RoleChoice } from '@/components/role-choice';
import { Container } from '@/components/ui/container';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { requireUser } from '@/lib/dal';
import { jobRepository } from '@/lib/infrastructure/job-repo';

export const metadata = { title: 'Welcome' };

/**
 * Where a new account answers which side of the hire it is on.
 *
 * It does not redirect an account that has already answered, and that is a
 * deliberate reversal. Sending a non-null role back to the dashboard read
 * well, right up until you notice the dashboard sends a null role here: two
 * pages each redirecting to the other is a redirect loop waiting for
 * `getRole()` to return two different answers in a row, and it returns null on
 * a failed query. A browser showing ERR_TOO_MANY_REDIRECTS is a worse failure
 * than any wrong screen.
 *
 * So this page just renders, and `current` is what stops it being a silent
 * flip: an account that has answered sees its own answer selected and a button
 * that says what pressing it does.
 */
export default async function OnboardingPage() {
  const user = await requireUser();
  const role = await jobRepository.getRole();

  const answered = role !== null;

  return (
    <main className="py-10 sm:py-14">
      <Container width="prose">
        <header className="animate-rise flex flex-col gap-2">
          <h1 className="text-fluid-2xl font-semibold tracking-tight">
            {answered ? `Hello again, ${user.firstName}` : `Welcome, ${user.firstName}`}
          </h1>
          <p className="text-muted-foreground">
            {answered
              ? 'You have answered this already. Change it here if you want to.'
              : 'One question, and then you are in.'}
          </p>
        </header>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle asChild className="text-fluid-lg">
              <h2>Which side are you on?</h2>
            </CardTitle>
            <CardDescription>
              You can only be one at a time. An account that could post the job
              it applies to would be a different thing entirely. You can change
              this whenever you like, here or in settings, and nothing you have
              stored is deleted when you do.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RoleChoice
              current={role}
              submitLabel={answered ? 'Switch sides' : 'Continue'}
            />
          </CardContent>
        </Card>
      </Container>
    </main>
  );
}
