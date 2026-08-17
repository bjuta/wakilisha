import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

const SUPABASE_URL = process.env.VITE_PUBLIC_SUPABASE_URL || '';
const ANON_KEY = process.env.VITE_PUBLIC_SUPABASE_ANON_KEY || '';

const anonClient = createClient(SUPABASE_URL || 'http://localhost:54321', ANON_KEY);

function expectNoPublicReadError(
  surface: string,
  error: { code?: string; message?: string; details?: string | null; hint?: string | null } | null,
) {
  expect(
    error,
    `${surface} must be readable by a signed-out visitor; public reads may not depend on privileged capability helpers`,
  ).toBeNull();
}

describe('production public content — anonymous read contract', () => {
  it('has real anonymous production credentials', () => {
    expect(SUPABASE_URL).toMatch(/^https:\/\/.+\.supabase\.co$/);
    expect(ANON_KEY.length).toBeGreaterThan(20);
  });

  it('reads the known published Guide exactly as the public route does', async () => {
    const { data, error } = await anonClient
      .from('guide_pages')
      .select('id,slug,status')
      .eq('slug', 'the-day-reading-changed')
      .eq('status', 'published');

    expectNoPublicReadError('guide_pages', error);
    expect(data).toHaveLength(1);
    expect(data?.[0]).toMatchObject({
      slug: 'the-day-reading-changed',
      status: 'published',
    });
  });

  it('reads release-track relationships for signed-out release pages', async () => {
    const { data, error } = await anonClient
      .from('registry_release_tracks')
      .select('release_id,track_id')
      .limit(1);

    expectNoPublicReadError('registry_release_tracks', error);
    expect(data?.length ?? 0).toBeGreaterThan(0);
  });

  it('keeps adjacent public registry reads healthy', async () => {
    for (const table of [
      'registry_release_artists',
      'registry_track_artists',
      'wk_chart_editions_v2',
    ]) {
      const { data, error } = await anonClient
        .from(table)
        .select('*')
        .limit(1);

      expectNoPublicReadError(table, error);
      expect(data?.length ?? 0).toBeGreaterThan(0);
    }
  });
});
