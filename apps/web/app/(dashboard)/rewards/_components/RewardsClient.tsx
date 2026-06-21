'use client';

import { useState } from 'react';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { StoreTab } from './StoreTab';
import { FulfillmentTab } from './FulfillmentTab';

type Tab = 'store' | 'fulfillment';

// Rewards parent surface: a "Store" catalog (CRUD, task #22) and a "Fulfillment"
// queue of purchased-but-not-yet-handed-out rewards (task #25). Both tabs fetch
// independently via the browser Supabase client (RLS scopes to the family).
export function RewardsClient() {
  const [tab, setTab] = useState<Tab>('store');

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-[28px] font-extrabold leading-tight text-ink-900">
        Rewards
      </h1>

      <div className="max-w-md">
        <SegmentedTabs
          tabs={[
            { value: 'store', label: 'Store' },
            { value: 'fulfillment', label: 'Fulfillment' },
          ]}
          value={tab}
          onChange={v => setTab(v as Tab)}
        />
      </div>

      {tab === 'store' ? <StoreTab /> : <FulfillmentTab />}
    </div>
  );
}
