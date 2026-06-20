import { Brand } from '@/components/ui/Brand';
import { Card } from '@/components/ui/Card';
import { CardHeader } from '@/components/ui/CardHeader';
import { LoginForm } from './LoginForm';

export default function LoginPage() {
  return (
    <>
      <Brand />
      <Card className="w-full">
        <div className="flex flex-col gap-5">
          <CardHeader title="Welcome back" subtitle="Log in to manage your family." />
          <LoginForm />
        </div>
      </Card>
    </>
  );
}
