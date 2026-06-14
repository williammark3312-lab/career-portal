/**
 * Returns the stable base URL for this application.
 * - Uses NEXT_PUBLIC_APP_URL env var if configured (production URL).
 * - Falls back to window.location.origin on the client.
 *
 * This ensures scheduling links always point to the production domain,
 * even if an admin generates a link while visiting a preview deployment URL.
 */
export function getAppBaseUrl(): string {
  // Server-safe env var (empty string falls through to origin)
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) return envUrl;

  // Client fallback
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "";
}
