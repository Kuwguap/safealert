import { Platform } from 'react-native';

// Web self-update: GitHub Pages caches index.html for ~10 minutes and iOS
// PWAs cache the shell until a cold start, so users can get stuck on stale
// builds. prepare-web.js stamps the build hash into window.__SA_VERSION and
// publishes version.json; we compare the two on launch, on focus, and every
// few minutes. `apply` force-revalidates the HTML cache then reloads.

const CHECK_MS = 5 * 60 * 1000;
const STARTUP_GRACE_MS = 20 * 1000;

export function startUpdateWatch(onUpdateAvailable: (apply: () => void) => void): () => void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return () => {};
  const current = (window as any).__SA_VERSION as string | undefined;
  if (!current) return () => {}; // dev server — no version stamp

  const base = window.location.pathname.replace(/\/(admin\/?)?$/, '');
  const startedAt = Date.now();
  let notified = false;

  const apply = async () => {
    try {
      // force-revalidate the cached HTML before reloading so the reload
      // actually picks up the new build
      await fetch(`${base}/index.html`, { cache: 'reload' });
      await fetch(`${base}/`, { cache: 'reload' });
    } catch {
      // still reload — worst case we come back on the next check
    }
    window.location.reload();
  };

  const check = async () => {
    if (notified) return;
    try {
      const res = await fetch(`${base}/version.json?ts=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const { v } = await res.json();
      if (v && v !== current) {
        if (Date.now() - startedAt < STARTUP_GRACE_MS) {
          // stale bundle detected right at launch — fix it silently
          apply();
        } else {
          notified = true;
          onUpdateAvailable(apply);
        }
      }
    } catch {
      // offline — try again later
    }
  };

  check();
  const interval = setInterval(check, CHECK_MS);
  const onVisible = () => {
    if (!document.hidden) check();
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    clearInterval(interval);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
