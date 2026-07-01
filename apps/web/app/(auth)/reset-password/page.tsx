import { Brand } from '@/components/ui/Brand';
import { Card } from '@/components/ui/Card';
import { ResetForm } from './ResetForm';

import { AuthCentered } from '../_AuthCentered';

export default function ResetPasswordPage() {
  return (
    <AuthCentered>
      <Brand />
      <Card className="w-full">
        <ResetForm />
      </Card>
    </AuthCentered>
  );
}
