// The bill inquiry the phone makes. It answers from the mock biller, in the API's shape, so a real call can replace it here alone.

import { BILL_REF_LENGTH, sampleBills, standardBill, type BillInquiryRequest, type BillInquiryResponse } from '../data/bills.ts';

export interface Bill {
  institution: string;
  billId: string;
  billReference: string;
  total: number;
  currency: string;
  components: { name: string; account: string; amount: number }[];
}

export async function billInquiry(req: BillInquiryRequest): Promise<BillInquiryResponse> {
  const ref = req.billReference.trim();
  return structuredClone(sampleBills[ref] ?? standardBill(ref));
}

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
