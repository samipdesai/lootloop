import { RewardsClient } from './_components/RewardsClient';

// Reward store (task #22) + fulfillment queue (task #25). The dashboard layout
// supplies nav + the family header; the catalog/form/queue are interactive, so
// they live in a client tree that fetches via the browser Supabase client (RLS
// scopes to the family).
export default function RewardsPage() {
  return <RewardsClient />;
}
