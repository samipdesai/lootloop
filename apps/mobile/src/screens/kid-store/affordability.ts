// Pure store helpers (#23/#24). Kept dependency-free so they're unit-testable
// without RN/Supabase. A reward is affordable when the kid's spendable wallet
// balance covers its cost; balance may be null while the wallet is still loading
// (treat as "can't afford yet" so we never show Buy before we know the balance).

export function canAfford(balance: number | null, cost: number): boolean {
  if (balance == null) return false;
  return balance >= cost;
}

// Loot still needed to buy a reward (0 once affordable). Used for the
// "Need N more" hint on disabled cards.
export function shortfall(balance: number | null, cost: number): number {
  if (balance == null) return cost;
  return Math.max(0, cost - balance);
}
