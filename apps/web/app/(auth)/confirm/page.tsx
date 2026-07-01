import { Suspense } from 'react';
import { Brand } from '@/components/ui/Brand';
import { Card } from '@/components/ui/Card';
import { ConfirmClient } from './ConfirmClient';

import { AuthCentered } from '../_AuthCentered';

export default function ConfirmPage() {
  return (
    <AuthCentered>
      <Brand />
      <Card className="w-full">
        <Suspense fallback={null}>
          <ConfirmClient />
        </Suspense>
      </Card>
    </AuthCentered>
  );
}
