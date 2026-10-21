// Bill inquiry replies in the exact shape of RSOP's POST /api/v1/billInquiry. Lookups go to the live API, which returned
// one bill, PKR 100,000 echoing the reference, for any reference; two invented bills answer locally to reach the other outcomes.

export interface BillInquiryRequest {
  institution: string;
  billReference: string;
}

export interface BillInquiryAccount {
  componentName: string;
  componentAccount: string;
  componentAmount: string;
}

export interface BillInquiryResponse {
  statusCode: number;
  description: string;
  billId?: string;
  billReference?: string;
  total?: string;
  currency?: string;
  billInquiryAccounts?: BillInquiryAccount[];
}

export interface BillPaymentRequest {
  billId: string;
  billReference: string;
  /** The bill's total, in the inquiry's own string form. */
  totalAmount: string;
}

export interface BillPaymentResponse {
  statusCode: number;
  description: string;
}

/** What the live API answered to a bill payment on 2026-10-21. */
export const paymentSuccess: BillPaymentResponse = { statusCode: 0, description: 'SUCCESS' };

/** The institutions the phone offers. */
export const institutions = ['FBR'];

/** A bill reference is exactly this many letters or digits. */
export const BILL_REF_LENGTH = 10;

const accounts = (amounts: number[]): BillInquiryAccount[] =>
  [
    ['Custom duty', '1111111111'],
    ['Sales tax', '2222222222'],
    ['Withholding tax', '3333333333'],
    ['Other levy', '4444444444'],
  ].map(([componentName, componentAccount], i) => ({
    componentName: componentName!,
    componentAccount: componentAccount!,
    componentAmount: String(amounts[i]),
  }));

const bill = (billId: string, billReference: string, amounts: number[]): BillInquiryResponse => ({
  statusCode: 0,
  description: 'SUCCESS',
  billId,
  billReference,
  total: String(amounts.reduce((a, b) => a + b, 0)),
  currency: 'PKR',
  billInquiryAccounts: accounts(amounts),
});

/** What the live API answered on 2026-10-21 for any reference: the same bill, with the reference echoed back. */
export const standardBill = (billReference: string) => bill('12345', billReference, [40_000, 35_000, 20_000, 5_000]);

/** Invented bills, answered without calling the API, so the alert and stopped outcomes stay reachable. */
export const localBills: Record<string, BillInquiryResponse> = {
  '4567890123': bill('12346', '4567890123', [180_000, 157_500, 90_000, 22_500]),
  '7890123456': bill('12347', '7890123456', [500_000, 437_500, 250_000, 62_500]),
};

/** The demo bills the phone offers: one the live API answers (shown here as captured), then the two local ones. */
export const sampleBills: Record<string, BillInquiryResponse> = {
  '1234567890': standardBill('1234567890'),
  ...localBills,
};
