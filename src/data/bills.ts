// Mock biller answers in the exact shape of RSOP's POST /api/v1/billInquiry. Bill 123 is the API's own reply;
// 456 and 789 are invented with the same component split, so the three bills land in the three screening bands.

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

export const sampleBills: Record<string, BillInquiryResponse> = {
  '123': bill('12345', '123', [40_000, 35_000, 20_000, 5_000]),
  '456': bill('12346', '456', [180_000, 157_500, 90_000, 22_500]),
  '789': bill('12347', '789', [500_000, 437_500, 250_000, 62_500]),
};

/** Invented: the real API's reply for an unknown bill has not been seen yet. */
export const notFound: BillInquiryResponse = { statusCode: 1, description: 'BILL NOT FOUND' };

/** The institution the API sample was called with; the demo-bill chips fill it in. */
export const SAMPLE_INSTITUTION = 'abc';
