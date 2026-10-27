import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { OriginCheckGuard } from './origin-check.guard';

function mockContext(
  method: string,
  origin?: string,
  extraHeaders: Record<string, string | string[] | undefined> = {},
  protocol = 'http',
): ExecutionContext {
  const request = {
    method,
    protocol,
    headers: {
      ...(origin ? { origin } : {}),
      ...extraHeaders,
    },
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}
describe('OriginCheckGuard', () => {
  const configService = { get: jest.fn().mockReturnValue('http://localhost:3002') };
  const guard = new OriginCheckGuard(configService as never);

  it('allows a POST request with a matching Origin header', () => {
    expect(guard.canActivate(mockContext('POST', 'http://localhost:3002'))).toBe(true);
  });

  it('rejects a POST request with a mismatched Origin header (403)', () => {
    expect(() => guard.canActivate(mockContext('POST', 'http://evil.com'))).toThrow(ForbiddenException);
  });

  it('allows a POST request with no Origin header (non-browser client, e.g. curl/server-to-server)', () => {
    expect(guard.canActivate(mockContext('POST', undefined))).toBe(true);
  });

  it('allows GET/HEAD/OPTIONS regardless of Origin — safe methods do not mutate state', () => {
    expect(guard.canActivate(mockContext('GET', 'http://evil.com'))).toBe(true);
    expect(guard.canActivate(mockContext('HEAD', 'http://evil.com'))).toBe(true);
    expect(guard.canActivate(mockContext('OPTIONS', 'http://evil.com'))).toBe(true);
  });

  it('rejects PUT/PATCH/DELETE with a mismatched Origin, not just POST', () => {
    expect(() => guard.canActivate(mockContext('PUT', 'http://evil.com'))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(mockContext('PATCH', 'http://evil.com'))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(mockContext('DELETE', 'http://evil.com'))).toThrow(ForbiddenException);
  });

  it('allows a POST request proxied via Next.js when Origin matches x-forwarded-host and x-forwarded-proto', () => {
    expect(
      guard.canActivate(
        mockContext('POST', 'http://172.16.2.88:3000', {
          'x-forwarded-host': '172.16.2.88:3000',
          'x-forwarded-proto': 'http',
          host: 'api:3001',
        }),
      ),
    ).toBe(true);
  });

  it('allows a POST request when Origin matches direct Host header (same-origin without WEB_ORIGIN match)', () => {
    expect(
      guard.canActivate(
        mockContext('POST', 'https://sap-monitor.maycha.vn', {
          host: 'sap-monitor.maycha.vn',
          'x-forwarded-proto': 'https',
        }),
      ),
    ).toBe(true);
  });

  it('allows comma-separated WEB_ORIGIN values and normalizes trailing slashes', () => {
    const multiConfig = {
      get: jest
        .fn()
        .mockReturnValue('http://localhost:3000/, https://sap.maycha.vn/ '),
    };
    const multiGuard = new OriginCheckGuard(multiConfig as never);

    expect(
      multiGuard.canActivate(mockContext('POST', 'https://sap.maycha.vn')),
    ).toBe(true);
    expect(
      multiGuard.canActivate(mockContext('POST', 'http://localhost:3000/')),
    ).toBe(true);
  });

  it('rejects a POST request when Origin mismatches both x-forwarded-host and WEB_ORIGIN', () => {
    expect(() =>
      guard.canActivate(
        mockContext('POST', 'https://attacker.example.com', {
          'x-forwarded-host': '172.16.2.88:3000',
          'x-forwarded-proto': 'http',
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects a malformed Origin header safely without throwing TypeError', () => {
    expect(() =>
      guard.canActivate(
        mockContext('POST', 'http://[::1', {
          'x-forwarded-host': '172.16.2.88:3000',
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects protocol downgrade (http Origin against https x-forwarded-proto)', () => {
    expect(() =>
      guard.canActivate(
        mockContext('POST', 'http://sap-monitor.maycha.vn', {
          'x-forwarded-host': 'sap-monitor.maycha.vn',
          'x-forwarded-proto': 'https',
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects port mismatch (non-standard port in Origin against standard port in host)', () => {
    expect(() =>
      guard.canActivate(
        mockContext('POST', 'https://sap-monitor.maycha.vn:8443', {
          'x-forwarded-host': 'sap-monitor.maycha.vn',
          'x-forwarded-proto': 'https',
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('selects the rightmost proxy hop in comma-separated x-forwarded-host headers', () => {
    expect(
      guard.canActivate(
        mockContext('POST', 'http://172.16.2.88:3000', {
          'x-forwarded-host': 'spoofed.evil.com, 172.16.2.88:3000',
          'x-forwarded-proto': 'http',
        }),
      ),
    ).toBe(true);
    expect(() =>
      guard.canActivate(
        mockContext('POST', 'http://spoofed.evil.com', {
          'x-forwarded-host': 'spoofed.evil.com, 172.16.2.88:3000',
          'x-forwarded-proto': 'http',
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects multi-valued array Origin header', () => {
    expect(() =>
      guard.canActivate(
        mockContext('POST', undefined, {
          origin: ['http://localhost:3002', 'http://evil.com'],
        }),
      ),
    ).toThrow(ForbiddenException);
  });
});
