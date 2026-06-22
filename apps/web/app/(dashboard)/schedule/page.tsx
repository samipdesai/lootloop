import { ScheduleClient } from './_components/ScheduleClient';

// Parent schedule management (task #36). The dashboard layout supplies nav + the
// family header; the by-kid list and add/edit form are interactive, so they live
// in a client tree that fetches via the browser Supabase client (RLS scopes to
// the family).
export default function SchedulePage() {
  return <ScheduleClient />;
}
