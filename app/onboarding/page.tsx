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

export const metadata = { title: 'Welcome' };

export default async function OnboardingPage() {
  const user = await requireUser();

  return (
    <main className="py-10 sm:py-14">
      <Container width="prose">
        <header className="animate-rise flex flex-col gap-2">
          <h1 className="text-fluid-2xl font-semibold tracking-tight">
            Welcome, {user.firstName}
          </h1>
          <p className="text-muted-foreground">
            One question, and then you are in.
          </p>
        </header>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle asChild className="text-fluid-lg">
              <h2>Which side are you on?</h2>
            </CardTitle>
            <CardDescription>
              You can only be one. An account that could post the job it applies
              to would be a different thing entirely.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RoleChoice />
          </CardContent>
        </Card>
      </Container>
    </main>
  );
}
