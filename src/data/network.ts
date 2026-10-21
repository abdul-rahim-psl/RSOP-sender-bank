// The rule and typology numbers from the reference screen, in its order. Both lists stop where the screenshot is cut off.

export const rules = [
  '001', '002', '003', '004', '006', '007', '008', '010', '011', '016', '017',
  '018', '020', '021', '024', '025', '026', '027', '028', '030', '044', '045',
  '048', '054', '063', '074', '075', '076', '078', '083', '084', '090', '091',
];

const typologyIds = [
  '001', '002', '003', '005', '010', '011', '013', '024', '028', '037', '044',
  '045', '047', '051', '052', '092', '095', '098', '105', '107', '121', '124',
  '129', '137', '169', '179', '185', '191', '195', '214', '216',
];

export interface Typology {
  id: string;
  /** Rule numbers this typology scores; invented for the demo, not a real typology configuration. */
  rules: string[];
}

// Spread offsets give each typology four rules from across the list; the tail rules go to the first typologies so none is left unused.
const OFFSETS = [0, 8, 17, 25];

export const typologies: Typology[] = typologyIds.map((id, i) => {
  const picks = OFFSETS.map((o) => (i + o) % rules.length);
  if (i + typologyIds.length < rules.length) picks.push(i + typologyIds.length);
  return { id, rules: picks.map((p) => rules[p]) };
});

/** Each rule hit adds this to every typology that uses the rule. */
export const HIT_WEIGHT = 100;
export const ALERT_AT = 200;
export const INTERDICT_AT = 400;

/** Amount bands for the mock screening, in whole currency units. */
export const ALERT_AMOUNT = 1_000;
export const STOP_AMOUNT = 10_000;

/** The sender's payment count, since Clear all, from which activity counts as rapid (the third payment). */
export const RAPID_FROM = 3;
