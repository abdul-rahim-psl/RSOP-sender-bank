// The shapes of RSOP's bill API, and the phone's input rules. Every bill lookup goes to the live API;
// on 2026-10-21 it answered one bill, PKR 100,000 echoing the reference, for any reference.

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

/** The institutions the phone offers. */
export const institutions = ['FBR'];

/** A bill reference is exactly this many letters or digits. */
export const BILL_REF_LENGTH = 10;

/** Quick-fill references on the phone. Every one is looked up on the live API, like anything typed. */
export const sampleRefs = ['1234567890', '4567890123', '7890123456'];
