const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const tracesSampleRate = Number(
  process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.05"
);

let initialized = false;

async function getSentry() {
  if (!dsn) return null;

  const Sentry = await import("@sentry/nextjs");
  if (!initialized) {
    Sentry.init({
      dsn,
      enabled: true,
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
      tracesSampleRate,
    });
    initialized = true;
  }

  return Sentry;
}

export function onRouterTransitionStart(
  href: string,
  navigationType: string
) {
  void getSentry().then((Sentry) => {
    (Sentry as { captureRouterTransitionStart?: (href: string, navigationType: string) => void } | null)
      ?.captureRouterTransitionStart?.(href, navigationType);
  });
}
