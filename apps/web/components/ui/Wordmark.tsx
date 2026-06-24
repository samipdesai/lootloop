// LootLoop two-tone wordmark: "Loot" inherits the surrounding text color,
// "Loop" is always brand orange. Use anywhere the brand name appears as a
// visual wordmark/logo or brand reference. Pass sizing/weight/base-color via
// className (the outer span). Not for running prose or legal copy — plain text
// reads better there.
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      Loot<span className="text-orange">Loop</span>
    </span>
  );
}
