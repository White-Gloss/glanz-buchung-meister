/**
 * Supabase publishable keys are opaque API keys, not user session JWTs.
 * Keep the API key in `apikey` and remove only the duplicate bearer value
 * that supabase-js adds for anonymous requests. Real session JWTs remain
 * untouched.
 */
export function createSupabasePublishableFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (supabaseKey.startsWith("sb_") && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}
