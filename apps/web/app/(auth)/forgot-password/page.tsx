import { Brand } from '@/components/ui/Brand';
import { Card } from '@/components/ui/Card';
import { ForgotForm } from './ForgotForm';

export default function ForgotPasswordPage() {
  return (
    <>
      <Brand />
      <Card className="w-full">
        <ForgotForm />
      </Card>
    </>
  );
}
