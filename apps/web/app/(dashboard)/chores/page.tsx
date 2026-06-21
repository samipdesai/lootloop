import { ChoresClient } from './_components/ChoresClient';

// Chore management (tasks #12 + #13). The dashboard layout supplies nav + the
// family header; the list/form are interactive, so they live in a client tree
// that fetches via the browser Supabase client (RLS scopes to the family).
export default function ChoresPage() {
  return <ChoresClient />;
}
