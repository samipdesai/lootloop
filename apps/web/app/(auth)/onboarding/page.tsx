import { Brand } from '@/components/ui/Brand';
import { Card } from '@/components/ui/Card';
import { OnboardingForm } from './OnboardingForm';

export default function OnboardingPage() {
  return (
    <>
      <Brand size={96} celebrate />
      <Card className="w-full">
        <OnboardingForm />
      </Card>
    </>
  );
}
