// server/bff/config.ts
import { z } from 'zod';

const envSchema = z.object({
  EH_HOST: z.string().url().default('https://192.168.50.157'),
  EH_API_KEY: z.string().min(1).default('PLACEHOLDER'),
  EH_VERIFY_SSL: z.coerce.boolean().default(false),
  EH_TIMEOUT_MS: z.coerce.number().int().default(15000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CACHE_MAX_SIZE: z.coerce.number().int().default(500),
  CACHE_TTL_MS: z.coerce.number().int().default(30000),
});

export const bffConfig = envSchema.parse(process.env);
export type BffConfig = z.infer<typeof envSchema>;
