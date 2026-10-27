import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

// Minimal CSRF compensating control for cookie-based auth. Cookies are
// auto-attached by the browser to same-origin AND cross-origin requests,
// unlike the Authorization: Bearer header this app used before — that
// changeover removes a security property the app had "by default"
// (README used to document this). This guard restores a baseline: reject
// state-changing requests whose Origin header doesn't match WEB_ORIGIN.
// It is NOT a full double-submit CSRF token — SameSite=Strict/Lax on the
// cookies (set in AuthController) is the primary defense for same-site
// deploys; this is defense-in-depth for the case a browser's SameSite
// enforcement doesn't apply (e.g. some older browsers, or misconfigured
// SameSite=None deploys that forgot the CSRF token this app doesn't ship).
const SAFE_METHODS: Record<string, true> = { GET: true, HEAD: true, OPTIONS: true };

function pickLastHopHeader(value: string | string[] | undefined): string {
  if (!value) {
    return '';
  }
  const raw = Array.isArray(value) ? value[value.length - 1] ?? '' : value;
  const parts = raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

export function isRequestOriginAllowed(
  request: Pick<Request, 'headers' | 'protocol'> & { hostname?: string },
  configuredWebOrigin?: string,
): boolean {
  const rawOrigin = request.headers.origin;
  if (!rawOrigin) {
    return true;
  }
  if (typeof rawOrigin !== 'string') {
    return false;
  }

  const requestOrigin = rawOrigin.trim().replace(/\/$/, '');
  let originUrl: URL;
  try {
    originUrl = new URL(requestOrigin);
  } catch {
    return false;
  }

  // 1. Same-Origin check: allow if Origin matches request's own host or trusted forwarded host (Next.js internal proxy)
  const forwardedHost = pickLastHopHeader(request.headers['x-forwarded-host']);
  const directHost = pickLastHopHeader(request.headers.host);
  const trustedForwardedHost =
    forwardedHost &&
    (!request.hostname || forwardedHost.split(':')[0] === request.hostname)
      ? forwardedHost
      : '';
  const hostCandidate = trustedForwardedHost || directHost;

  const forwardedProto = pickLastHopHeader(request.headers['x-forwarded-proto']);
  const protoCandidate = forwardedProto || request.protocol || 'http';

  if (hostCandidate) {
    const expectedProto = `${protoCandidate}:`;
    if (originUrl.protocol === expectedProto) {
      const defaultPort = protoCandidate === 'https' ? '443' : '80';
      const expectedHost = hostCandidate.includes(':')
        ? hostCandidate
        : `${hostCandidate}:${defaultPort}`;
      const actualHost = originUrl.port
        ? originUrl.host
        : `${originUrl.hostname}:${defaultPort}`;
      if (actualHost === expectedHost) {
        return true;
      }
    }
  }
  // 2. Explicitly allowed external origins from WEB_ORIGIN config (comma-separated)
  const webOrigin = configuredWebOrigin ?? 'http://localhost:3000';
  const allowedOrigins = webOrigin
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

  return allowedOrigins.includes(requestOrigin);
}

@Injectable()
export class OriginCheckGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (SAFE_METHODS[request.method]) {
      return true;
    }

    const webOrigin = this.configService.get<string>('WEB_ORIGIN');
    if (!isRequestOriginAllowed(request, webOrigin)) {
      throw new ForbiddenException('Origin not allowed');
    }

    return true;
  }
}
