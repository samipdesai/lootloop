import { Brand } from '@/components/ui/Brand';
import { Card } from '@/components/ui/Card';
import { CardHeader } from '@/components/ui/CardHeader';
import { SignupForm } from './SignupForm';

export default function SignupPage() {
  return (
    <>
      <Brand />
      <Card className="w-full">
        <div className="flex flex-col gap-5">
          <CardHeader title="Create your account" subtitle="Start managing chores & rewards." />
          <SignupForm />
        </div>
      </Card>
    </>
  );
}
