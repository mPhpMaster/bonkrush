/** Strip BOM/quotes/whitespace and keep header-safe ASCII for Supabase env vars. */
function sanitizeEnvValue(raw: string | undefined): string {
  if (!raw) return "";
  let value = raw.trim().replace(/^\uFEFF/, "");
  // Vercel/dashboard sometimes stores values wrapped in quotes.
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  // Fetch headers must be ISO-8859-1; remove accidental unicode from copy/paste.
  value = value.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
  return value;
}

export function getSupabaseEnv(): { url: string; anonKey: string } {
  const url = sanitizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = sanitizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!url || !anonKey || anonKey === "YOUR_ANON_KEY_HERE") {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return { url, anonKey };
}
