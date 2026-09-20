/**
 * Runtime configuration.
 *
 * Values come from (highest priority first):
 *   1. window.__APP_CONFIG__  - written at container start from environment variables
 *      (see docker/40-runtime-config.sh), so ONE build can serve any company.
 *   2. VITE_* variables       - build-time values, used during local development.
 *   3. Safe defaults.
 */
interface RuntimeConfig {
    APP_NAME?: string;
    APP_TAGLINE?: string;
    API_URL?: string;
    DEMO_MODE?: string | boolean;
}

declare global {
    interface Window {
        __APP_CONFIG__?: RuntimeConfig;
    }
}

const runtime: RuntimeConfig = window.__APP_CONFIG__ ?? {};
const env = import.meta.env;

const text = (rt: string | undefined, build: string | undefined, fallback: string): string =>
    (rt && rt.trim()) || (build && build.trim()) || fallback;

const flag = (rt: string | boolean | undefined, build: string | undefined): boolean => {
    const v = rt !== undefined && rt !== '' ? rt : build;
    return v === true || v === 'true' || v === '1';
};

export const config = {
    APP_NAME: text(runtime.APP_NAME, env.VITE_APP_NAME, 'TaskBot Pro'),
    APP_TAGLINE: text(runtime.APP_TAGLINE, env.VITE_APP_TAGLINE, 'Workforce & Task Management'),
    // Production default is same-origin (/api/v1), which the bundled nginx proxies to the API.
    API_URL: text(runtime.API_URL, env.VITE_API_URL, env.DEV ? 'http://localhost:3000/api/v1' : '/api/v1'),
    // Demo quick-login buttons. Never enabled unless explicitly requested.
    DEMO_MODE: flag(runtime.DEMO_MODE, env.VITE_DEMO_MODE),
} as const;
