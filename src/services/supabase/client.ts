import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { createFreshFetch } from './freshFetch';

let client: SupabaseClient<Database> | null | undefined;

function getSupabaseConfiguration() {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  return url && publishableKey ? { url, publishableKey } : null;
}

/**
 * Returns the browser client used by the shared Production application when
 * both public Supabase environment values are configured. Calling this
 * function only constructs the client; it does not issue a request.
 */
export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (client !== undefined) {
    return client;
  }

  const configuration = getSupabaseConfiguration();

  if (!configuration) {
    client = null;
    return client;
  }

  client = createClient<Database>(configuration.url, configuration.publishableKey, {
    global: {
      fetch: createFreshFetch(),
    },
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfiguration() !== null;
}
