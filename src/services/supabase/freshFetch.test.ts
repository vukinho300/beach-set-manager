import { describe, expect, it, vi } from 'vitest';
import { createFreshFetch } from './freshFetch';

describe('createFreshFetch', () => {
  it('forces Supabase requests to bypass browser HTTP caches', async () => {
    const response = new Response('{}', { status: 200 });
    const fetchImplementation = vi.fn(async () => response);
    const freshFetch = createFreshFetch(fetchImplementation);

    await freshFetch('https://example.supabase.co/rest/v1/location_state', {
      headers: { apikey: 'public-key' },
      cache: 'force-cache',
    });

    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://example.supabase.co/rest/v1/location_state',
      {
        headers: { apikey: 'public-key' },
        cache: 'no-store',
      },
    );
  });
});
