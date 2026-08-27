export type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

/**
 * Supabase is the operational source of truth. Browser or service-worker HTTP
 * caches must never satisfy Auth, membership, or location_state requests.
 */
export function createFreshFetch(
  fetchImplementation: FetchImplementation = globalThis.fetch.bind(globalThis),
): FetchImplementation {
  return (input, init) => fetchImplementation(input, {
    ...init,
    cache: 'no-store',
  });
}
