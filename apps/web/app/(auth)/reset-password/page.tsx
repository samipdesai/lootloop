import { Brand } from '@/components/ui/Brand';
import { Card } from '@/components/ui/Card';
import { ResetForm } from './ResetForm';

export default function ResetPasswordPage() {
  return (
    <>
      <Brand />
      <Card className="w-full">
        <ResetForm />
      </Card>
    </>
  );
}
