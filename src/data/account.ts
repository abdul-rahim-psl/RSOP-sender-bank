// The one fictional account holder using the phone.

export const CURRENCY = 'PKR';

export interface Account {
  name: string;
  provider: string;
  /** A fictional account number; receipts show it masked. */
  accountNo: string;
  /** A party colour token from the RSOP family, for the avatar and balance card. */
  color: string;
  balance: number;
}

export const account: Account = {
  name: 'Bilal Siddiqui',
  provider: 'XYZ Bank',
  accountNo: '01570103482468',
  color: 'blue',
  balance: 2_500_000,
};

/** "Bilal Siddiqui" → "BS"; a username splits on dots, dashes and underscores too: "abdul.rahim" → "AR". */
export const initials = (name: string) =>
  name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/** A receipt's account title from a username: "abdul.rahim" → "ABDUL RAHIM". */
export const accountTitle = (username: string) => username.trim().split(/[\s._-]+/).filter(Boolean).join(' ').toUpperCase();

/** A number or reference as receipts show it: its first and last four, "0157xxx2468". */
export const masked = (s: string) => (s.length > 8 ? `${s.slice(0, 4)}xxx${s.slice(-4)}` : s);

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
