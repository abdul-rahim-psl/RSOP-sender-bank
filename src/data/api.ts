// The paths the page calls on its own server. server/bill-api.mjs forwards the bill inquiry to RSOP's API
// (address in .env, API_BASE); the bill payment is still answered by the mock in src/lib/biller.ts.

export const endpoints = {
  billInquiry: '/api/v1/billInquiry',
  billPayment: '/api/v1/billPayment',
} as const;
