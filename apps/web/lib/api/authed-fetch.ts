const getBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    return process.env.API_INTERNAL_URL ?? 'http://localhost:3001';
  }
  return '/api';
};
const REFRESH_PATH = '/auth/refresh';

// Module-scope singleton: dedupes concurrent 401s within the same tab into
// 1 actual refresh call. Without this, N requests that 401 in the same tick
// each fire their own /auth/refresh, all racing the same CAS rotation —
// only 1 can win, the rest exhaust their single retry and fail silently.
let refreshInFlight: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  let refresh = await fetch(`${getBaseUrl()}${REFRESH_PATH}`, { method: 'POST', credentials: 'include' });
  // 409: a concurrent request already rotated this session (benign race,
  // backend's compare-and-swap). One more attempt succeeds against the
  // already-rotated cookie.
  if (refresh.status === 409) {
    refresh = await fetch(`${getBaseUrl()}${REFRESH_PATH}`, { method: 'POST', credentials: 'include' });
  }
  return refresh.ok;
}

export function refreshOnce(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

// Cookie-based auth: the browser attaches the httpOnly access cookie itself,
// so no Authorization header is built here. credentials:'include' is what
// makes that happen cross-origin (web :8081, api :3001).
export async function authedFetch(input: string, init?: RequestInit): Promise<Response> {
  let res = await fetch(input, { ...init, credentials: 'include' });
  if (res.status === 401) {
    const ok = await refreshOnce();
    if (ok) {
      res = await fetch(input, { ...init, credentials: 'include' });
    }
  }
  return res;
}
