import { CURRENCY } from '../data/parties.ts';

const fmt2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "USD 2,500.00". */
export const money = (amount: number) => `${CURRENCY} ${fmt2.format(amount)}`;

/** Reads what a person types in the amount box: "2,500", "2500.5". Null when it is not a usable amount. */
export function parseAmount(text: string): number | null {
  const clean = text.replace(/[,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const n = Number(clean);
  return n > 0 ? n : null;
}
