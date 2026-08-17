import { describe, expect, it } from 'vitest';

const SUPABASE_URL = process.env.VITE_PUBLIC_SUPABASE_URL || '';
const ANON_KEY = process.env.VITE_PUBLIC_SUPABASE_ANON_KEY || '';

async function edgeRequest(
  functionName: string,
  init: RequestInit,
): Promise<Response> {
  return fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    ...init,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      Origin: 'https://wakilisha.africa',
      ...(init.headers || {}),
    },
  });
}

describe('production public Edge Functions — anonymous runtime contract', () => {
  it('has real anonymous production credentials', () => {
    expect(SUPABASE_URL).toMatch(/^https:\/\/.+\.supabase\.co$/);
    expect(ANON_KEY.length).toBeGreaterThan(20);
  });

  it('public-content-read is reachable anonymously with production CORS', async () => {
    const response = await edgeRequest('public-content-read', {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'GET',
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://wakilisha.africa');
  });

  it('link-preview-read executes anonymous request logic, not only its deployment shell', async () => {
    const response = await edgeRequest('link-preview-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://127.0.0.1/' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://wakilisha.africa');
    await expect(response.json()).resolves.toMatchObject({
      data: null,
      error: 'private_target',
    });
  });
});
