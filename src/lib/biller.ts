// The bill inquiry and bill payment the phone makes. Both go to RSOP's live API through the page's own server,
// which adds the headers the API needs (server/bill-api.mjs).

import { endpoints } from '../data/api.ts';
import {
  BILL_REF_LENGTH,
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

/** The biller's refusal, keeping its statusCode so the phone can tell an already-paid bill from a failure. */
export class BillerError extends Error {
  statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

/** The biller's statusCode for a bill its DB already marks paid. */
export const ALREADY_PAID = 101;

/** POSTs JSON to the page's own server; throws a short reason when there is no usable reply. */
export async function postJson(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const data: unknown = await res.json().catch(() => null);
  const { description, statusCode } = (data ?? {}) as { description?: unknown; statusCode?: unknown };
  if (!res.ok)
    throw new BillerError(
      typeof description === 'string' && description ? description : `HTTP ${res.status}`,
      typeof statusCode === 'number' ? statusCode : undefined,
    );
  if (!data || typeof data !== 'object') throw new Error('UNREADABLE REPLY');
  return data;
}

/** Looks the bill up on the live API, through the page's own server. */
export async function billInquiry(req: BillInquiryRequest, post: Post = postJson): Promise<BillInquiryResponse> {
  const body = { institution: req.institution, billReference: req.billReference.trim() };
  return (await post(endpoints.billInquiry, body)) as BillInquiryResponse;
}

/** Pays the bill on the live API, through the page's own server. */
export async function billPayment(req: BillPaymentRequest, post: Post = postJson): Promise<BillPaymentResponse> {
  return (await post(endpoints.billPayment, req)) as BillPaymentResponse;
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
