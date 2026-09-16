import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(32).optional(),
  INTEGRATION_ENCRYPTION_KEY: z.string().min(32).optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
});

export const env = schema.superRefine((value, ctx) => {
  if (value.NODE_ENV === 'production') {
    if (!value.JWT_SECRET) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_SECRET'], message: 'JWT_SECRET is required in production' });
    if (!value.DATABASE_URL) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['DATABASE_URL'], message: 'DATABASE_URL is required in production' });
    if (!value.INTEGRATION_ENCRYPTION_KEY) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['INTEGRATION_ENCRYPTION_KEY'], message: 'INTEGRATION_ENCRYPTION_KEY is required in production' });
    if (value.WEB_ORIGIN.startsWith('http://localhost')) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['WEB_ORIGIN'], message: 'WEB_ORIGIN must point to the deployed HTTPS web origin in production' });
  }
  if (value.NODE_ENV !== 'production' && !value.JWT_SECRET) {
    value.JWT_SECRET = 'development-only-change-this-secret-please';
  }
}).parse(process.env);
