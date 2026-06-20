/** Monthly compound interest rate for kids' savings (5% teaching rate). */
export const MONTHLY_RATE = 0.05;

/** Calculate interest earned on a balance for one month. */
export function calculateInterest(balance: number): number {
  return Math.round(balance * MONTHLY_RATE);
}

/** Project how much interest would be earned if amount is saved. */
export function projectInterest(currentSavings: number, additionalAmount: number): number {
  return calculateInterest(currentSavings + additionalAmount);
}
