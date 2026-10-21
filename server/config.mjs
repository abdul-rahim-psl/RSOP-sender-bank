// Settings for the bill API proxy: the environment, or a git-ignored .env next to package.json.
// The participant codes stay out of the repo because it is public.

import { existsSync } from 'node:fs';

const envFile = new URL('../.env', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

export const config = {
  apiBase: process.env.API_BASE || 'http://192.168.9.15:9991',
  senderParticipantCode: process.env.SENDER_PARTICIPANT_CODE || '',
  receiverParticipantCode: process.env.RECEIVER_PARTICIPANT_CODE || '',
  senderUserCode: process.env.SENDER_USER_CODE || '',
  timeoutMs: Number(process.env.API_TIMEOUT_MS) || 8000,
};
