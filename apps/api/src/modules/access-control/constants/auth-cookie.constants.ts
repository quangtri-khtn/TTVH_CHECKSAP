// Single source of truth for auth cookie names — imported by JwtStrategy
// (reads), AuthController (sets/clears), and every test that needs to
// attach/assert a cookie. Never hardcode these strings elsewhere.
export const ACCESS_COOKIE_NAME = 'ttvh_sap_access_token';
export const REFRESH_COOKIE_NAME = 'ttvh_sap_refresh_token';

// Phải đặt '/' vì trình duyệt gọi qua proxy Next.js tại '/api/auth/refresh'
// và '/api/auth/logout' (nếu đặt '/auth' thì trình duyệt sẽ không đính kèm
// refresh cookie vào đường dẫn '/api/auth/*').
export const REFRESH_COOKIE_PATH = '/';
