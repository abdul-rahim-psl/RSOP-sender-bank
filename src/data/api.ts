// The paths the page calls on its own server. server/bill-api.mjs forwards both to RSOP's API (address in .env, API_BASE).

export const endpoints = {
  billInquiry: '/api/v1/billInquiry',
  billPayment: '/api/v1/billPayment',
} as const;
