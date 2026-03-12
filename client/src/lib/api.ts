// client/src/lib/api.ts
// BFF fetch wrapper — uses same origin since BFF is integrated into the main server

export class BffError extends Error {
  status: number;
  body: Record<string, unknown>;
  constructor(message: string, status: number, body: Record<string, unknown>) {
    super(message);
    this.name = 'BffError';
    this.status = status;
    this.body = body;
  }
}

export async function bffGet<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  }
  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new BffError(body.error || `BFF ${res.status}`, res.status, body);
  }
  return res.json();
}
