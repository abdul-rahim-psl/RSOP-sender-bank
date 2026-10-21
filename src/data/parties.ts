// Fictional people and wallet providers. Phone numbers sit in the 555-0100 to 555-0199 range kept for fiction.

export const CURRENCY = 'USD';

export const providers = ['Kestrel Pay', 'Lakeside Bank', 'Harbor Mobile Money', 'Juniper Bank'];

export interface Party {
  id: string;
  name: string;
  phone: string;
  provider: string;
  /** A party colour token from the RSOP family, for the avatar. */
  color: string;
}

export interface Sender extends Party {
  balance: number;
  /** On the block list, so the event flow check stops every payment from them. */
  blocked: boolean;
}

export const senders: Sender[] = [
  { id: 's1', name: 'Amara Okafor', phone: '+1 555 0101', provider: 'Kestrel Pay', color: 'violet', balance: 25_000, blocked: false },
  { id: 's2', name: 'Bilal Siddiqui', phone: '+1 555 0102', provider: 'Lakeside Bank', color: 'blue', balance: 18_500, blocked: false },
  { id: 's3', name: 'Chen Wei', phone: '+1 555 0103', provider: 'Harbor Mobile Money', color: 'pink', balance: 12_000, blocked: false },
  { id: 's4', name: 'Daniela Ruiz', phone: '+1 555 0104', provider: 'Juniper Bank', color: 'orange', balance: 40_000, blocked: true },
];

export const recipients: Party[] = [
  { id: 'r1', name: 'Ayesha Khan', phone: '+1 555 0111', provider: 'Lakeside Bank', color: 'green' },
  { id: 'r2', name: 'Kwame Mensah', phone: '+1 555 0112', provider: 'Kestrel Pay', color: 'blue' },
  { id: 'r3', name: 'Lena Fischer', phone: '+1 555 0113', provider: 'Juniper Bank', color: 'violet' },
  { id: 'r4', name: 'Tomás Silva', phone: '+1 555 0114', provider: 'Harbor Mobile Money', color: 'orange' },
];

/** One quick amount per mock outcome: no alert, alert, stopped. */
export const quickAmounts = [250, 2_500, 12_000];

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
