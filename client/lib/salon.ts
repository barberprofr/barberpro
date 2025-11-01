export type SalonId = string;

const KEY = "selectedSalonId";
const DEFAULT_SALON: SalonId = "main";

export function getSelectedSalon(): SalonId {
  if (typeof window === "undefined") return DEFAULT_SALON;
  const v = window.localStorage.getItem(KEY);
  return (v && /^[a-z0-9-]{1,40}$/i.test(v)) ? v : DEFAULT_SALON;
}

export function setSelectedSalon(id: SalonId) {
  if (typeof window === "undefined") return;
  const norm = normalizeSalonId(id);
  window.localStorage.setItem(KEY, norm);
}

export function normalizeSalonId(nameOrId: string): SalonId {
  return (nameOrId || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || DEFAULT_SALON;
}

export function listKnownSalons(): SalonId[] {
  // Demo: persist a CSV list in localStorage. Real app should fetch from backend.
  if (typeof window === "undefined") return [DEFAULT_SALON];
  const raw = window.localStorage.getItem("salons:list") || DEFAULT_SALON;
  return Array.from(new Set(raw.split(",").map(s => s.trim()).filter(Boolean)));
}

export function addKnownSalon(idOrName: string) {
  if (typeof window === "undefined") return;
  const id = normalizeSalonId(idOrName);
  const current = listKnownSalons();
  if (!current.includes(id)) {
    const next = [...current, id].join(",");
    window.localStorage.setItem("salons:list", next);
  }
}
