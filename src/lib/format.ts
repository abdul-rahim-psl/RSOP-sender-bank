import { CURRENCY } from '../data/account.ts';

const fmt2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "PKR 100,000.00". */
export const money = (amount: number, currency = CURRENCY) => `${currency} ${fmt2.format(amount)}`;
