import { ApprovalQueue } from './_components/ApprovalQueue';

// Parent Approval Queue (task #17) + award wiring (task #18). Client component
// loads the pending completions and drives approve/reject against the atomic
// award_points_on_approval SQL fn.
export default function ApprovalsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-[28px] font-extrabold leading-tight text-ink-900">
        Approvals
      </h1>
      <ApprovalQueue />
    </div>
  );
}
