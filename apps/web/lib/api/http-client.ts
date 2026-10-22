import { refreshOnce } from './authed-fetch';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const getBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    return process.env.API_INTERNAL_URL ?? 'http://localhost:3001';
  }
  return '/api';
};

// Orval's react-query client (fetch mode) calls the mutator as
// customFetch<TResponse>(url, init), where TResponse is already the full
// { data, status, headers } shape generated per-endpoint. So this function
// constructs and returns that exact shape — it does not wrap a T inside
// another `data` layer.
export const customFetch = async <
  TResponse extends { data: unknown; status: number; headers: Headers },
>(
  url: string,
  init?: RequestInit,
): Promise<TResponse> => {
  // FormData bodies (multipart file upload) must NOT get a manual
  // Content-Type — the browser sets it itself with the required boundary
  // param. Forcing application/json here makes the server see an empty
  // body with no error surfaced anywhere in the request/response cycle.
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;

  const performFetch = () =>
    fetch(`${getBaseUrl()}${url}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...init?.headers,
      },
    });

  let response = await performFetch();
  // Authentication endpoints must never trigger a refresh-retry — a 401
  // on /auth/login or /auth/microsoft-sso is simply bad credentials, and
  // /auth/refresh would recurse forever if its own token is invalid.
  const isAuthEndpoint = ['/auth/refresh', '/auth/login', '/auth/microsoft-sso'].some((path) =>
    url.endsWith(path),
  );
  if (response.status === 401 && !isAuthEndpoint) {
    const ok = await refreshOnce();
    if (ok) {
      response = await performFetch();
    }
  }

  if (!response.ok) {
    if (response.status === 403 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:forbidden'));
    }
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.message ?? `HTTP ${response.status}`);
  }

  // 204 / empty body would crash response.json().
  const data =
    response.status === 204 || response.headers.get('content-length') === '0'
      ? undefined
      : await response.json();

  // NO unwrapping of `data` itself — deliberate. The API documents its
  // responses with envelope DTOs ({ statusCode, data }), so the Orval-
  // generated type IS the envelope and already matches this body exactly.
  // Unwrapping here would desync the generated types from what callers
  // actually receive. Call sites read `res.data.data` (fetch-wrapper `data`,
  // then the API's own envelope `data`).
  return { data, status: response.status, headers: response.headers } as TResponse;
};

export default customFetch;
