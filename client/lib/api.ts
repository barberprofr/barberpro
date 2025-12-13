import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getSelectedSalon } from "./salon";

const envVars = import.meta.env as Record<string, string | undefined>;
const envApiBaseUrl = envVars?.VITE_API_BASE_URL?.trim();

// In development, use /api. In production on Netlify, /.netlify/functions/api is redirected to /api
const API_BASES: string[] = envApiBaseUrl ? [envApiBaseUrl] : ["/api"];

export function apiPath(input: string): string {
  const salon = getSelectedSalon();
  const path = input.startsWith("/api") ? input.slice(4) : input;
  // If already targeting /salons/:id, keep it; else prefix
  if (path.startsWith("/salons/")) return path;
  return `/salons/${encodeURIComponent(salon)}${path}`;
}

function normalizeBase(base: string): string {
  return base.replace(/\/+$/, "");
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function resolveBaseCandidates(base: string): string[] {
  const candidates = new Set<string>();
  const sanitizedBase = normalizeBase(base.startsWith("/") ? base : `/${base}`);

  if (envApiBaseUrl) {
    candidates.add(normalizeBase(envApiBaseUrl));
  }

  if (sanitizedBase.startsWith("http://") || sanitizedBase.startsWith("https://")) {
    candidates.add(sanitizedBase);
  } else {
    if (typeof window !== "undefined" && window.location?.origin) {
      candidates.add(normalizeBase(`${window.location.origin}${sanitizedBase}`));
    }
    const globalOrigin = typeof globalThis !== "undefined" && (globalThis as any).location?.origin;
    if (typeof globalOrigin === "string") {
      candidates.add(normalizeBase(`${globalOrigin}${sanitizedBase}`));
    }
    candidates.add(sanitizedBase);
  }

  return Array.from(candidates);
}

function buildUrl(base: string, path: string): string {
  const basePart = normalizeBase(base);
  const pathPart = normalizePath(path);
  return `${basePart}${pathPart}`;
}

function sanitizeInit(init?: RequestInit): RequestInit | undefined {
  if (!init) return undefined;
  const next: RequestInit = { ...init };
  if (init.headers) {
    const headers = new Headers(init.headers as HeadersInit);
    for (const [key, value] of headers.entries()) {
      if (value == null || String(value).trim() === "") {
        headers.delete(key);
      }
    }
    if ([...headers.keys()].length > 0) {
      next.headers = headers;
    } else {
      delete next.headers;
    }
  }
  return next;
}

async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const requestInit = sanitizeInit(init);
  // Force no-store to prevent caching of API responses, especially for PWA
  const finalInit = { ...requestInit, cache: 'no-store' as RequestCache };

  const normalizedPath = normalizePath(apiPath(input));
  const attemptedUrls: string[] = [];
  let lastErr: any = null;

  for (const base of API_BASES) {
    const baseOptions = base === "/.netlify/functions/api"
      ? [base, `${base}/api`]
      : [base];
    for (const baseOption of baseOptions) {
      const candidates = resolveBaseCandidates(baseOption);
      for (const candidate of candidates) {
        const url = buildUrl(candidate, normalizedPath);
        attemptedUrls.push(url);
        try {
          const res = await fetch(url, finalInit);
          if (res.status !== 404) return res;
          lastErr = new Error(`HTTP ${res.status} at ${url}`);
        } catch (e) {
          lastErr = e;
        }
      }
    }
  }

  const errorMsg = lastErr?.message || "Unknown error";
  const msg = `Failed to fetch ${normalizedPath}. Attempted: ${attemptedUrls.join(", ")}. Error: ${errorMsg}`;
  console.error(msg, { attemptedUrls, lastErr });
  throw new Error(msg);
}

async function throwResponseError(res: Response): Promise<never> {
  let message = res.statusText || `HTTP ${res.status}`;
  try {
    const text = await res.clone().text();
    if (text) {
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object") {
          const fromField = typeof parsed.error === "string" ? parsed.error : typeof parsed.message === "string" ? parsed.message : null;
          message = fromField || (typeof parsed === "string" ? parsed : text);
        } else {
          message = text;
        }
      } catch {
        message = text;
      }
    }
  } catch {
    // ignore, fallback handled by status text
  }
  throw new Error(JSON.stringify({ error: message || `HTTP ${res.status}` }));
}

export type PaymentMethod = "cash" | "check" | "card";

export interface StylistStats {
  dailyAmount: number;
  dailyCount: number;
  monthlyAmount: number;
  monthlyCount: number;
  dailyPointsUsed?: number;
  monthlyPointsUsed?: number;
}

export interface Stylist { id: string; name: string; stats?: StylistStats; commissionPct?: number; }
export interface Client { id: string; name: string; points: number; email: string | null; phone: string | null; lastVisitAt: number | null; photos: string[] }
export interface Prestation { id: string; stylistId: string; clientId?: string; amount: number; paymentMethod: PaymentMethod; timestamp: number; pointsPercent: number; pointsAwarded: number }
export interface Product { id: string; stylistId: string; clientId?: string; amount: number; paymentMethod: PaymentMethod; timestamp: number }
export interface Service { id: string; name: string; price: number; description?: string; sortOrder?: number }
export interface ProductType { id: string; name: string; price: number; description?: string }
export interface PointsUsageEntry {
  id: string;
  clientId: string;
  points: number;
  timestamp: number;
  reason: string;
  clientName: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
}
export interface PointsUsageGroup {
  stylistId: string;
  stylistName: string;
  totalPoints: number;
  entries: PointsUsageEntry[];
}
export interface PointsUsageReport {
  daily: PointsUsageGroup[];
  monthly: PointsUsageGroup[];
  generatedAt: number;
}

export function useStylists() {
  const salonId = getSelectedSalon();
  return useQuery({
    queryKey: ["stylists", salonId], queryFn: async () => {
      const res = await apiFetch("/api/stylists");
      if (!res.ok) throw new Error("Failed to load stylists");
      const data = await res.json() as { stylists: Stylist[] };
      return data.stylists;
    }
  });
}

export function useClients(enabled: boolean = true) {
  const salonId = getSelectedSalon();
  return useQuery({
    queryKey: ["clients", salonId], enabled, queryFn: async () => {
      const res = await apiFetch("/api/clients");
      if (!res.ok) throw new Error("Failed to load clients");
      const data = await res.json() as { clients: Client[] };
      return data.clients;
    }
  });
}

export interface SummaryPayments { total: PaymentBreakdown; methods: Record<MethodKey, PaymentBreakdown> }
export interface DashboardSummary {
  dailyAmount: number; dailyCount: number; monthlyAmount: number; monthlyCount: number; dailyProductCount?: number; monthlyProductCount?: number;
  lastPrestations: Prestation[];
  dailyPayments: SummaryPayments;
  monthlyPayments: SummaryPayments;
}

export function useDashboardSummary() {
  const salonId = getSelectedSalon();
  return useQuery({
    queryKey: ["summary", salonId], queryFn: async (): Promise<DashboardSummary> => {
      const res = await apiFetch("/api/reports/summary");
      if (!res.ok) throw new Error("Failed to load summary");
      return res.json();
    }
  });
}

export function useAddPrestation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { stylistId: string; clientId?: string; amount: number; paymentMethod: PaymentMethod; timestamp: number; pointsPercent?: number; serviceName?: string; serviceId?: string; }) => {
      const res = await apiFetch("/api/prestations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!res.ok) await throwResponseError(res);
      return res.json() as Promise<{ prestation: Prestation; client?: Client }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stylists"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    }
  });
}

export function useAddProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { stylistId: string; clientId?: string; amount: number; paymentMethod: PaymentMethod; timestamp: number; productName?: string; productTypeId?: string; }) => {
      const res = await apiFetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!res.ok) await throwResponseError(res);
      return res.json() as Promise<{ product: Product; client?: Client }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stylists"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    }
  });
}

export function useProducts() {
  const salonId = getSelectedSalon();
  return useQuery({
    queryKey: ["products", salonId],
    queryFn: async () => {
      const res = await apiFetch("/api/products");
      if (!res.ok) await throwResponseError(res);
      const data = await res.json() as { products: Product[] };
      return data.products;
    }
  });
}

export interface AddClientInput {
  name: string;
  email?: string;
  phone?: string;
}

export function useAddClient() {
  const qc = useQueryClient();
  return useMutation<{ client: Client }, unknown, AddClientInput>({
    mutationFn: async ({ name, email, phone }) => {
      const payload: Record<string, unknown> = { name };
      if (email) payload.email = email;
      if (phone) payload.phone = phone;
      const res = await apiFetch("/api/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) await throwResponseError(res);
      return res.json() as Promise<{ client: Client }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] })
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/clients/${id}`, { method: "DELETE", headers: { "x-admin-token": getAdminToken() || "" } });
      if (!res.ok) await throwResponseError(res);
      return res.json() as Promise<{ ok: true }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] })
  });
}

import { getAdminToken } from "./admin";

export function useAddStylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; commissionPct?: number } | string) => {
      const body = typeof input === "string" ? { name: input } : input;
      const res = await apiFetch("/api/stylists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": getAdminToken() || "",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) await throwResponseError(res);
      return res.json() as Promise<{ stylist: Stylist }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stylists"] })
  });
}

export function useRedeemPoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { clientId: string; points: number; reason?: string; stylistId?: string }) => {
      const res = await apiFetch("/api/clients/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!res.ok) await throwResponseError(res);
      return res.json() as Promise<{ client: Client; usage?: { stylistId: string; points: number; timestamp: number; reason: string } }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["stylists"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      qc.invalidateQueries({ queryKey: ["stylist-breakdown"] });
      qc.invalidateQueries({ queryKey: ["points-usage-report"] });
    }
  });
}

export function usePointsUsageReport(day?: string, month?: string) {
  const salonId = getSelectedSalon();
  return useQuery({
    queryKey: ["points-usage-report", salonId, day || "current-day", month || "current-month"],
    queryFn: async (): Promise<PointsUsageReport> => {
      const params = new URLSearchParams();
      if (day) params.set("day", day);
      if (month) params.set("month", month);
      const qs = params.toString();
      const url = qs ? `/api/reports/points-usage?${qs}` : "/api/reports/points-usage";
      const res = await apiFetch(url);
      if (!res.ok) throw new Error("Failed to load points usage report");
      return res.json() as Promise<PointsUsageReport>;
    },
  });
}

export type MethodKey = "cash" | "check" | "card";
export interface PaymentBreakdown { amount: number; count: number }
export interface StylistBreakdown {
  daily: { total: PaymentBreakdown; methods: Record<MethodKey, PaymentBreakdown> };
  monthly: { total: PaymentBreakdown; methods: Record<MethodKey, PaymentBreakdown> };
  dailyEntries?: { id: string; amount: number; paymentMethod: MethodKey; timestamp: number; kind: "prestation" | "produit"; name?: string }[];
}

export function useStylistBreakdown(stylistId?: string, date?: string) {
  const salonId = getSelectedSalon();
  return useQuery({
    queryKey: ["stylist-breakdown", salonId, stylistId, date || "today"],
    enabled: !!stylistId,
    queryFn: async () => {
      const qs = date ? `?date=${encodeURIComponent(date)}` : "";
      const res = await apiFetch(`/api/stylists/${stylistId}/breakdown${qs}`);
      if (!res.ok) throw new Error("Failed to load breakdown");
      return res.json() as Promise<StylistBreakdown>;
    }
  });
}

export function useRevenueByDay(year?: number, month?: number) {
  const salonId = getSelectedSalon();
  return useQuery({
    queryKey: ["revenue-by-day", salonId, year ?? "current", month ?? "current"],
    queryFn: async () => {
      const url = typeof year === "number" && typeof month === "number"
        ? `/api/reports/by-day?year=${year}&month=${month}`
        : "/api/reports/by-day";
      const res = await apiFetch(url);
      if (!res.ok) throw new Error("Failed to load by-day report");
      return res.json() as Promise<{ days: { date: string; amount: number; count: number; salary?: number; methods?: Record<MethodKey, PaymentBreakdown> }[]; methods: Record<MethodKey, PaymentBreakdown>; total: PaymentBreakdown; salaryTotal?: number }>;
    }
  });
}

export function useRevenueByMonth(year?: number) {
  const salonId = getSelectedSalon();
  return useQuery({
    queryKey: ["revenue-by-month", salonId, year ?? "current"],
    queryFn: async () => {
      const url = typeof year === "number" ? `/api/reports/by-month?year=${year}` : "/api/reports/by-month";
      const res = await apiFetch(url);
      if (!res.ok) throw new Error("Failed to load by-month report");
      return res.json() as Promise<{
        months: { month: string; amount: number; count: number; salary: number }[];
        methods: Record<MethodKey, PaymentBreakdown>;
        total: PaymentBreakdown;
        salaryTotal: number;
      }>;
    }
  });
}

export function useConfig() {
  const salonId = getSelectedSalon();
  return useQuery({
    queryKey: ["config", salonId],
    queryFn: async () => {
      const res = await apiFetch("/api/config", { headers: { "x-admin-token": getAdminToken() || "" } });
      if (!res.ok) throw new Error("Failed to load config");
      return res.json() as Promise<{ loyaltyPercentDefault: number; paymentModes: MethodKey[]; commissionDefault: number; pointsRedeemDefault: number; adminSet: boolean; adminCodeSet: boolean; isAdmin: boolean; accountEmail: string | null; adminEmail: string | null; salonName: string | null; salonAddress: string | null; salonPostalCode: string | null; salonCity: string | null; salonPhone: string | null; subscriptionStatus: string | null; stripeCustomerId: string | null; stripeSubscriptionId: string | null; subscriptionCurrentPeriodEnd: number | null }>;
    }
  });
}

export function useUpdateConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<{ loyaltyPercentDefault: number; paymentModes: MethodKey[]; commissionDefault: number; pointsRedeemDefault: number; salonName: string | null }>) => {
      const res = await apiFetch("/api/admin/config", { method: "PATCH", headers: { "Content-Type": "application/json", "x-admin-token": getAdminToken() || "" }, body: JSON.stringify(input) });
      if (!res.ok) await throwResponseError(res);
      return res.json() as Promise<{ ok: true }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["config"] })
  });
}

import { setAdminToken } from "./admin";

export function useAdminSetupAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { salonId: string; password: string; email: string; salonName: string; salonAddress: string; salonPostalCode: string; salonCity: string; salonPhone: string; adminCode?: string }) => {
      const res = await apiFetch(`/api/salons/${encodeURIComponent(input.salonId)}/admin/setup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!res.ok) await throwResponseError(res);
      return res.json() as Promise<{ token: string }>;
    },
    onSuccess: (data) => {
      setAdminToken(data.token);
      qc.invalidateQueries({ queryKey: ["config"] });
    }
  });
}

export function useAdminUpdateCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { newCode: string; currentCode?: string; email?: string }) => {
      const payload = { password: input.newCode, currentPassword: input.currentCode, email: input.email };
      const res = await apiFetch("/api/admin/set-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) await throwResponseError(res);
      return res.json() as Promise<{ token: string; salonId?: string }>;
    },
    onSuccess: (data) => {
      setAdminToken(data.token);
      qc.invalidateQueries({ queryKey: ["config"] });
    }
  });
}

export function useAdminVerifyCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { code: string }) => {
      const res = await apiFetch("/api/admin/code/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!res.ok) await throwResponseError(res);
      return res.json() as Promise<{ token: string; salonId?: string }>;
    },
    onSuccess: (data) => {
      setAdminToken(data.token);
      qc.invalidateQueries({ queryKey: ["config"] });
    }
  });
}

export function useAdminLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const res = await apiFetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!res.ok) await throwResponseError(res);
      return res.json() as Promise<{ token: string; salonId?: string }>;
    },
    onSuccess: (data) => {
      setAdminToken(data.token);
      qc.invalidateQueries({ queryKey: ["config"] });
    }
  });
}

// Create a Stripe Checkout session for subscription
export async function createCheckoutSession() {
  const res = await apiFetch("/api/create-checkout-session", { method: "POST" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to create checkout session");
  }
  return res.json() as Promise<{ url?: string; id?: string }>;
}

export function useAdminRecover() {
  return useMutation({
    mutationFn: async (email: string) => {
      const res = await apiFetch("/api/admin/recover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      if (!res.ok) await throwResponseError(res);
      return res.json() as Promise<{ ok: true; emailed?: boolean }>;
    }
  });
}

export function useAdminRecoverVerify() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; code: string; newPassword: string }) => {
      const res = await apiFetch("/api/admin/recover/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!res.ok) await throwResponseError(res);
      return res.json() as Promise<{ token: string; salonId?: string }>;
    },
    onSuccess: (data) => {
      setAdminToken(data.token);
      qc.invalidateQueries({ queryKey: ["config"] });
    }
  });
}


// === NOUVELLES FONCTIONS POUR RÉCUPÉRATION CODE ADMIN ===

export function useAdminRecoverCode() {
  return useMutation({
    mutationFn: async (email: string) => {
      const res = await apiFetch("/api/admin/recover-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      if (!res.ok) await throwResponseError(res);
      return res.json() as Promise<{ ok: true; emailed?: boolean }>;
    }
  });
}

export function useAdminRecoverCodeVerify() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; code: string; newAdminCode: string }) => {
      const res = await apiFetch("/api/admin/recover-code/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      if (!res.ok) await throwResponseError(res);
      return res.json() as Promise<{ token: string; salonId?: string }>;
    },
    onSuccess: (data) => {
      setAdminToken(data.token);
      qc.invalidateQueries({ queryKey: ["config"] });
    }
  });
}

export function useSetStylistCommission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, commissionPct, name }: { id: string; commissionPct?: number; name?: string }) => {
      const payload: Record<string, unknown> = {};
      if (typeof commissionPct === "number") payload.commissionPct = commissionPct;
      if (typeof name === "string") payload.name = name;
      if (!Object.keys(payload).length) throw new Error("Aucune donnée à mettre à jour");
      const res = await apiFetch(`/api/admin/stylists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": getAdminToken() || "" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) await throwResponseError(res);
      return res.json() as Promise<{ stylist: Stylist }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stylists"] })
  });
}

export function useDeleteStylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/stylists/${id}`, { method: "DELETE" });
      if (!res.ok) await throwResponseError(res);
      return res.json() as Promise<{ ok: true }>;
    },
    onSuccess: (_data, id) => {
      qc.setQueryData<Stylist[] | undefined>(["stylists"], (prev) => prev?.filter((s) => s.id !== id));
      qc.invalidateQueries({ queryKey: ["stylists"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      qc.invalidateQueries({ queryKey: ["revenue-by-day"] });
      qc.invalidateQueries({ queryKey: ["revenue-by-month"] });
      qc.invalidateQueries({ queryKey: ["stylist-breakdown"] });
      qc.removeQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "stylist-breakdown" &&
          typeof query.queryKey[1] === "string" &&
          query.queryKey[1] === id,
      });
    }
  });
}

export function useServices() {
  const salonId = getSelectedSalon();
  return useQuery({
    queryKey: ["services", salonId], queryFn: async () => {
      const res = await apiFetch("/api/services");
      if (!res.ok) throw new Error("Failed to load services");
      const data = await res.json() as { services: Service[] };
      return data.services;
    }
  });
}

export function useAddService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; price: number; description?: string }) => {
      const res = await apiFetch("/api/services", { method: "POST", headers: { "Content-Type": "application/json", "x-admin-token": getAdminToken() || "" }, body: JSON.stringify(input) });
      if (!res.ok) await throwResponseError(res);
      return res.json() as Promise<{ service: Service }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
    }
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/services/${id}`, { method: "DELETE", headers: { "x-admin-token": getAdminToken() || "" } });
      if (!res.ok) await throwResponseError(res);
      return res.json() as Promise<{ ok: true }>;
    },
    onSuccess: (_data, id) => {
      qc.setQueryData<Service[] | undefined>(["services"], (prev) => prev?.filter((s) => s.id !== id));
      qc.invalidateQueries({ queryKey: ["services"] });
    }
  });
}

export function useReorderServices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const res = await apiFetch("/api/services/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-token": getAdminToken() || "" },
        body: JSON.stringify({ orderedIds })
      });
      if (!res.ok) await throwResponseError(res);
      return res.json() as Promise<{ services: Service[] }>;
    },
    onSuccess: (data) => {
      qc.setQueryData<Service[] | undefined>(["services"], () => data.services);
    }
  });
}

export function useProductTypes() {
  const salonId = getSelectedSalon();
  return useQuery({
    queryKey: ["product-types", salonId], queryFn: async () => {
      const res = await apiFetch("/api/product-types");
      if (!res.ok) throw new Error("Failed to load product types");
      const data = await res.json() as { productTypes: ProductType[] };
      return data.productTypes;
    }
  });
}

export function useAddProductType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; price: number; description?: string }) => {
      const res = await apiFetch("/api/product-types", { method: "POST", headers: { "Content-Type": "application/json", "x-admin-token": getAdminToken() || "" }, body: JSON.stringify(input) });
      if (!res.ok) await throwResponseError(res);
      return res.json() as Promise<{ productType: ProductType }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-types"] });
    }
  });
}

export function useDeleteProductType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/product-types/${id}`, { method: "DELETE", headers: { "x-admin-token": getAdminToken() || "" } });
      if (!res.ok) await throwResponseError(res);
      return res.json() as Promise<{ ok: true }>;
    },
    onSuccess: (_data, id) => {
      qc.setQueryData<ProductType[] | undefined>(["product-types"], (prev) => prev?.filter((p) => p.id !== id));
      qc.invalidateQueries({ queryKey: ["product-types"] });
    }
  });
}

export function useAddPoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { clientId: string; points: number }) => {
      const res = await apiFetch("/api/clients/add-points", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": getAdminToken() || "" },
        body: JSON.stringify(input)
      });
      if (!res.ok) await throwResponseError(res);
      return res.json() as Promise<{ client: Client }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
    }
  });
}

export function useUpdateTransactionPaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; kind: "prestation" | "produit"; paymentMethod: PaymentMethod }) => {
      const res = await apiFetch("/api/transactions/update-payment-method", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": getAdminToken() || "" },
        body: JSON.stringify(input)
      });
      if (!res.ok) await throwResponseError(res);
      return res.json() as Promise<{ ok: true }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stylist-breakdown"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      qc.invalidateQueries({ queryKey: ["revenue-by-day"] });
      qc.invalidateQueries({ queryKey: ["revenue-by-month"] });
    }
  });
}


export function useUploadClientPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, file }: { clientId: string; file: File }) => {
      const formData = new FormData();
      formData.append('photo', file);
      const res = await apiFetch(`/api/clients/${clientId}/photos`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) await throwResponseError(res);
      return res.json() as Promise<{ client: Client }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
    }
  });
}


export function useDeleteClientPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, photoUrl }: { clientId: string; photoUrl: string }) => {
      const res = await apiFetch(`/api/clients/${clientId}/photos`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl }),
      });
      if (!res.ok) await throwResponseError(res);
      return res.json() as Promise<{ client: Client }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
    }
  });
}

