// Inline coin-with-star mark (mirrors the design's inline coin SVG). Rendered in
// many sizes/positions across the marketing hero, phone mock, and auth brand
// panels, so it's a parameterized component rather than a public asset.
export function Coin({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      className={className}
    >
      <circle cx="24" cy="24" r="20" fill="#FFC93C" />
      <circle cx="24" cy="24" r="20" stroke="#F0B315" strokeWidth="2.5" />
      <path
        d="M24 15l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2-4.5-4.4 6.2-.9z"
        fill="#fff"
      />
    </svg>
  );
}
