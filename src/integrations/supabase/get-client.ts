type SupabaseBrowserClient = (typeof import("./client"))["supabase"];

let clientPromise: Promise<SupabaseBrowserClient> | undefined;

/**
 * Keep Supabase out of the public page bundle. The browser client is only
 * downloaded when login, password recovery, or an authenticated action needs
 * it.
 */
export function getSupabaseClient(): Promise<SupabaseBrowserClient> {
  clientPromise ??= import("./client").then(({ supabase }) => supabase);
  return clientPromise;
}
