import 'dotenv/config';
import { z } from 'zod';

/**
 * Central, validated configuration. Every deployment-specific value lives here
 * and is read from environment variables, so the same build can be installed
 * for any company without code changes. See /.env.example for the full list.
 */

const bool = (def: boolean) =>
    z
        .enum(['true', 'false', '1', '0'])
        .optional()
        .transform((v) => (v === undefined ? def : v === 'true' || v === '1'));

const csv = z
    .string()
    .optional()
    .transform((v) =>
        (v ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
    );

const optionalString = z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined));

const schema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    TEST_DATABASE_URL: optionalString,
    DEFAULT_TIMEZONE: z.string().default('UTC').refine((tz) => {
        try {
            new Intl.DateTimeFormat('en', { timeZone: tz });
            return true;
        } catch {
            return false;
        }
    }, 'DEFAULT_TIMEZONE must be a valid IANA timezone (e.g. UTC, Asia/Kolkata)'),

    // --- Auth -------------------------------------------------------------
    JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
    JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),

    // --- Network / browser --------------------------------------------------
    APP_URL: z.string().default('http://localhost:5173'),
    CORS_ORIGINS: csv,
    COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).default('strict'),
    COOKIE_DOMAIN: optionalString,
    COOKIE_SECURE: bool(false),
    // Number of reverse proxies in front of the API (nginx, load balancer). 0 = none.
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),

    // --- Rate limiting --------------------------------------------------------
    RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(1000),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),

    // --- Runtime switches -------------------------------------------------------
    // Set to false on all but one instance if you ever run more than one API server.
    ENABLE_CRON: bool(true),
    MULTI_COMPANY_ENABLED: bool(false),
    ENCRYPTION_KEY: optionalString,

    // --- Files ------------------------------------------------------------------
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    UPLOAD_DIR: z.string().default('uploads'),

    // --- Email (optional; features that need it stay disabled when unset) ---------
    SMTP_HOST: optionalString,
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: bool(false),
    SMTP_USER: optionalString,
    SMTP_PASS: optionalString,
    MAIL_FROM: optionalString,

    // --- AI (optional; AI features stay disabled when AI_PROVIDER=none) -------------
    AI_PROVIDER: z.enum(['none', 'anthropic', 'openai_compatible']).default('none'),
    ANTHROPIC_API_KEY: optionalString,
    AI_BASE_URL: optionalString,
    AI_API_KEY: optionalString,
    AI_MODEL_FAST: optionalString,
    AI_MODEL_SMART: optionalString,
    AI_MONTHLY_BUDGET_USD: z.coerce.number().min(0).default(0),
    EMBEDDINGS_PROVIDER: z.enum(['none', 'voyage', 'openai_compatible']).default('none'),
    EMBEDDINGS_API_KEY: optionalString,
    EMBEDDINGS_MODEL: optionalString,
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.') || 'env'}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}\nSee .env.example for reference.`);
}

const env = parsed.data;

// Extra safety rules that only matter in production.
if (env.NODE_ENV === 'production') {
    const problems: string[] = [];
    if (env.JWT_ACCESS_SECRET.length < 32) problems.push('JWT_ACCESS_SECRET must be at least 32 characters in production');
    if (env.JWT_REFRESH_SECRET.length < 32) problems.push('JWT_REFRESH_SECRET must be at least 32 characters in production');
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) problems.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
    if (env.COOKIE_SAMESITE === 'none' && !env.COOKIE_SECURE) problems.push('COOKIE_SAMESITE=none requires COOKIE_SECURE=true');
    if (env.ENCRYPTION_KEY && env.ENCRYPTION_KEY.length < 32) problems.push('ENCRYPTION_KEY must be at least 32 characters in production');
    if (problems.length) {
        throw new Error(`Unsafe production configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    }
}

export const config = {
    ...env,
    // Browsers only send an Origin header we can match; default to the app's own URL.
    CORS_ORIGINS: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : [env.APP_URL],
    isProduction: env.NODE_ENV === 'production',
    emailEnabled: Boolean(env.SMTP_HOST && env.MAIL_FROM),
    aiEnabled: env.AI_PROVIDER !== 'none',
} as const;

export type AppConfig = typeof config;
