import type { Config } from 'drizzle-kit';

export default {
  schema: './src/main/db/schema/index.ts',
  out: './src/main/db/migrations',
  driver: 'better-sqlite',
  dbCredentials: {
    url: './data/merqo.db',
  },
  verbose: true,
  strict: true,
} satisfies Config;
