import { Brand } from '@/components/ui/Brand';
import { Card } from '@/components/ui/Card';
import { ForgotForm } from './ForgotForm';

import { AuthCentered } from '../_AuthCentered';

export default function ForgotPasswordPage() {
  return (
    <AuthCentered>
      <Brand />
      <Card className="w-full">
        <ForgotForm />
      </Card>
    </AuthCentered>
  );
}
