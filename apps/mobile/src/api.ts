declare const process: { env?: Record<string, string | undefined> };

const configuredApiUrl = process.env?.EXPO_PUBLIC_API_URL?.trim();
const API_BASE = (configuredApiUrl || 'http://localhost:4000/api/v1').replace(/\/$/, '');
export const API_ROOT = API_BASE.endsWith('/api/v1') ? API_BASE : `${API_BASE}/api/v1`;

export async function apiRequest(path: string, token?: string, init: RequestInit = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body;
}
