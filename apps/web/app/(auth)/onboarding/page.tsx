import { Brand } from '@/components/ui/Brand';
import { Card } from '@/components/ui/Card';
import { OnboardingForm } from './OnboardingForm';

import { AuthCentered } from '../_AuthCentered';

export default function OnboardingPage() {
  return (
    <AuthCentered>
      <Brand size={96} celebrate />
      <Card className="w-full">
        <OnboardingForm />
      </Card>
    </AuthCentered>
  );
}
