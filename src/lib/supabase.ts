import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fxksnkvyeyypkckehqpx.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_m-6h20CT-bCsXpkRPOtZ2Q_g98HQo8H";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist the session in localStorage across page reloads
    persistSession: true,
    // Automatically try to refresh the access token before it expires
    autoRefreshToken: true,
    // Detect the session from the URL hash (needed for magic-link / OAuth flows)
    detectSessionInUrl: true,
  },
});

/**
 * Listen for TOKEN_REFRESH failures (stale / missing refresh token).
 * When this happens Supabase internally signs the user out and emits
 * SIGNED_OUT, but also logs an AuthApiError in the console.  Calling
 * signOut() here clears any corrupt token data from localStorage so
 * the error stops appearing on subsequent page loads.
 */
supabase.auth.onAuthStateChange((event) => {
  if (event === "TOKEN_REFRESHED") return; // normal refresh – nothing to do
  if (event === "SIGNED_OUT") {
    // Purge any stale auth keys from localStorage to prevent repeated errors
    if (typeof window !== "undefined") {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("sb-") && k.includes("-auth-token"))
        .forEach((k) => localStorage.removeItem(k));
    }
  }
});