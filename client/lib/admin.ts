const KEY = "adminToken";

export function getAdminToken(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function setAdminToken(token: string | null) {
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch {}
}

export function isAdminClient(): boolean {
  return !!getAdminToken();
}
