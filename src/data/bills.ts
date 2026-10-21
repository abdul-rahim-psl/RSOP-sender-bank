// Mock biller answers in the exact shape of RSOP's POST /api/v1/billInquiry. The live API returns one bill,
// PKR 100,000 echoing the reference, for any reference; 4567890123 and 7890123456 are invented to reach the other outcomes.

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

/** What the live API answers for any reference: the same bill, with the reference echoed back. */
export const standardBill = (billReference: string) => bill('12345', billReference, [40_000, 35_000, 20_000, 5_000]);

export const sampleBills: Record<string, BillInquiryResponse> = {
  '1234567890': standardBill('1234567890'),
  '4567890123': bill('12346', '4567890123', [180_000, 157_500, 90_000, 22_500]),
  '7890123456': bill('12347', '7890123456', [500_000, 437_500, 250_000, 62_500]),
};
