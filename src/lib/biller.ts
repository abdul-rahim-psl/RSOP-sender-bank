// The bill inquiry the phone makes. It answers from the mock biller, in the API's shape, so a real call can replace it here alone.

import { notFound, sampleBills, type BillInquiryRequest, type BillInquiryResponse } from '../data/bills.ts';

export interface Bill {
  institution: string;
  billId: string;
  billReference: string;
  total: number;
  currency: string;
  components: { name: string; account: string; amount: number }[];
}

export async function billInquiry(req: BillInquiryRequest): Promise<BillInquiryResponse> {
  return structuredClone(sampleBills[req.billReference.trim()] ?? notFound);
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
