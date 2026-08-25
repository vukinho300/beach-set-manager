import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

let client: SupabaseClient<Database> | null | undefined;

function getSupabaseConfiguration() {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  return url && publishableKey ? { url, publishableKey } : null;
}

/**
 * Returns a browser client only when both public Supabase environment values
 * are configured. Calling this function only constructs the client; it does
 * not issue a request. The current local-only app does not call it.
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

  client = createClient<Database>(configuration.url, configuration.publishableKey);
  return client;
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfiguration() !== null;
}
