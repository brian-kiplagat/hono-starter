import 'dotenv/config';

import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('3500'),
  LOG_LEVEL: z.string().default('info'),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  SECRET_KEY: z.string(),
  DB_HOST: z.string().default('localhost'),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),
  BREVO_API_KEY: z.string(),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_CALLBACK_URL: z.string(),
  GOOGLE_REDIRECT_URL: z.string(),
  FRONTEND_URL: z.string(),
  BRAND_NAME: z.string().default('Elevnt.io'),
  WEBSOCKET_PORT: z.string().default('8081'),
  BITGO_ACCESS_TOKEN: z.string(),
  BITGO_WALLET_ID: z.string(),
});

export default envSchema.parse(process.env);
