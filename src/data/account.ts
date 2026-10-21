// The one fictional account holder using the phone. The phone number sits in the 555-0100 to 555-0199 range kept for fiction.

export const CURRENCY = 'PKR';

export interface Account {
  name: string;
  phone: string;
  provider: string;
  /** A party colour token from the RSOP family, for the avatar and balance card. */
  color: string;
  balance: number;
}

export const account: Account = {
  name: 'Bilal Siddiqui',
  phone: '+1 555 0102',
  provider: 'Lakeside Bank',
  color: 'blue',
  balance: 2_500_000,
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
