/** Add points to a balance, returning the new balance. */
export function addPoints(balance: number, amount: number): number {
  if (amount < 0) throw new Error('amount must be non-negative');
  return balance + amount;
}

/** Deduct points from a balance. Throws if insufficient funds. */
export function deductPoints(balance: number, amount: number): number {
  if (amount < 0) throw new Error('amount must be non-negative');
  if (balance < amount) throw new Error('insufficient balance');
  return balance - amount;
}
