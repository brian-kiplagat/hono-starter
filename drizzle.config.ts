import 'dotenv/config';
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema/migration/*',
  out: './src/schema/out',
  driver: 'mysql2',
  dbCredentials: {
    host: process.env.DB_HOST!,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME!,
  },
} satisfies Config;
