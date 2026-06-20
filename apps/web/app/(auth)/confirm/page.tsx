import { Suspense } from 'react';
import { Brand } from '@/components/ui/Brand';
import { Card } from '@/components/ui/Card';
import { ConfirmClient } from './ConfirmClient';

export default function ConfirmPage() {
  return (
    <>
      <Brand />
      <Card className="w-full">
        <Suspense fallback={null}>
          <ConfirmClient />
        </Suspense>
      </Card>
    </>
  );
}
