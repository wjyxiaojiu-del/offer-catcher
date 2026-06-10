/**
 * Server-side helpers for reading device-id from API requests.
 */

export function getDeviceIdFromRequest(req: Request): string | undefined {
  return req.headers.get("x-device-id") || undefined
}
