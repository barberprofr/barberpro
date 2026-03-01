import { useSyncExternalStore } from "react";

export type SalonId = string;

const KEY = "selectedSalonId";
// DEPRECATED: We no longer use "main" as a fallback.
// const DEFAULT_SALON: SalonId = "main";

let cachedSalonId: SalonId | null = null;
let salonChangeListeners: (() => void)[] = [];

export function getSelectedSalon(): SalonId | null {
  if (typeof window === "undefined") return null;
  if (cachedSalonId) return cachedSalonId;
  const v = window.localStorage.getItem(KEY);
  cachedSalonId = (v && /^[a-z0-9-]{1,64}$/i.test(v)) ? v : null;

  // If no salon in localStorage, try to get it from the URL mapping if it's there
  if (!cachedSalonId) {
    const pathParts = window.location.pathname.split('/');
    const salonIndex = pathParts.indexOf('salons');
    if (salonIndex !== -1 && pathParts[salonIndex + 1]) {
      const idFromUrl = pathParts[salonIndex + 1];
      if (/^[a-z0-9-]{1,64}$/i.test(idFromUrl)) {
        cachedSalonId = idFromUrl.toLowerCase();
        window.localStorage.setItem(KEY, cachedSalonId);
      }
    }
  }

  return cachedSalonId;
}

export function setSelectedSalon(id: SalonId) {
  if (typeof window === "undefined") return;
  const norm = normalizeSalonId(id);
  window.localStorage.setItem(KEY, norm);
  cachedSalonId = norm;
  salonChangeListeners.forEach(fn => fn());
}

export function clearSalonCache() {
  cachedSalonId = null;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem("salons:list");
  }
}

function subscribe(callback: () => void): () => void {
  salonChangeListeners.push(callback);
  return () => {
    salonChangeListeners = salonChangeListeners.filter(fn => fn !== callback);
  };
}

function getSnapshot(): SalonId {
  return getSelectedSalon();
}

function getServerSnapshot(): SalonId | null {
  return null;
}

export function useSalonId(): SalonId | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function onSalonChange(listener: () => void): () => void {
  salonChangeListeners.push(listener);
  return () => {
    salonChangeListeners = salonChangeListeners.filter(fn => fn !== listener);
  };
}

export function normalizeSalonId(nameOrId: string): SalonId {
  return (nameOrId || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

export function listKnownSalons(): SalonId[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem("salons:list") || "";
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
