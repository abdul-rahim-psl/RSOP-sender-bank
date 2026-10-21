// The bill inquiry and bill payment the phone makes. The inquiry goes to the live API through the page's own server;
// the payment is still a mock in the API's exact shape, so a real call can replace that one function alone.

import { endpoints } from '../data/api.ts';
import {
  BILL_REF_LENGTH,
  localBills,
  paymentSuccess,
  type BillInquiryRequest,
  type BillInquiryResponse,
  type BillPaymentRequest,
  type BillPaymentResponse,
} from '../data/bills.ts';

export interface Bill {
  institution: string;
  billId: string;
  billReference: string;
  total: number;
  currency: string;
  components: { name: string; account: string; amount: number }[];
}

type Post = (path: string, body: unknown) => Promise<unknown>;

/** POSTs JSON to the page's own server; throws a short reason when there is no usable reply. */
export async function postJson(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const data: unknown = await res.json().catch(() => null);
  const description = (data as { description?: unknown } | null)?.description;
  if (!res.ok) throw new Error(typeof description === 'string' && description ? description : `HTTP ${res.status}`);
  if (!data || typeof data !== 'object') throw new Error('UNREADABLE REPLY');
  return data;
}

/** The invented demo bills answer locally; every other reference is looked up on the live API. */
export async function billInquiry(req: BillInquiryRequest, post: Post = postJson): Promise<BillInquiryResponse> {
  const ref = req.billReference.trim();
  const local = localBills[ref];
  if (local) return structuredClone(local);
  return (await post(endpoints.billInquiry, { institution: req.institution, billReference: ref })) as BillInquiryResponse;
}

/** Answers like POST /api/v1/billPayment did for the one payment seen so far: SUCCESS. */
export async function billPayment(_req: BillPaymentRequest): Promise<BillPaymentResponse> {
  return structuredClone(paymentSuccess);
}

/** The billPayment body for a looked-up bill. */
export const paymentRequest = (b: Bill): BillPaymentRequest => ({
  billId: b.billId,
  billReference: b.billReference,
  totalAmount: String(b.total),
});

/** Why a bill reference can't be looked up yet, or null when it can. */
export function billRefProblem(text: string): string | null {
  const ref = text.trim();
  if (!ref) return `Enter the ${BILL_REF_LENGTH}-character bill reference.`;
  if (!/^[A-Za-z0-9]+$/.test(ref)) return 'Use letters and digits only.';
  if (ref.length !== BILL_REF_LENGTH) return `The bill reference is ${BILL_REF_LENGTH} characters; this has ${ref.length}.`;
  return null;
}

/** The reply as the screen uses it; null unless the biller found the bill. */
export function toBill(institution: string, res: BillInquiryResponse): Bill | null {
  if (res.statusCode !== 0 || !res.billId || !res.total || !res.billInquiryAccounts) return null;
  return {
    institution: institution.trim(),
    billId: res.billId,
    billReference: res.billReference ?? '',
    total: Number(res.total),
    currency: res.currency ?? '',
    components: res.billInquiryAccounts.map((a) => ({
      name: a.componentName,
      account: a.componentAccount,
      amount: Number(a.componentAmount),
    })),
  };
}
