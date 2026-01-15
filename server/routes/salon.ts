import { RequestHandler } from "express";
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import { createHash, randomBytes } from "node:crypto";
import { IncomingMessage } from "node:http";
import { EmailService } from './emailService.ts';
import {
  Stylist, Client, Prestation, PointsRedemption,
  Service, ProductType, Product, Settings, StylistDeposit,
  IStylist, IClient, IPrestation, IPointsRedemption,
  IService, IProductType, IProduct, ISettings, IStylistDeposit,
  PaymentMethod
} from "./models.ts";

// Connexion à la base de données (à appeler au démarrage de l'application)
import { connectDatabase } from "../db.ts";

// Email -> SalonId mapping pour la récupération de compte
const emailToSalonId = new Map<string, string>();

// ⭐️ RÉINTÉGRATION : Système de période d'essai
const parsedTrialDays = Number(process.env.SUBSCRIPTION_TRIAL_DAYS ?? "14");
const TRIAL_DURATION_DAYS = Number.isFinite(parsedTrialDays) ? Math.max(0, parsedTrialDays) : 14;
const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;

// Parser manuel pour Netlify Functions - OPTIMISÉ (sans logs)
async function parseRequestBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const body = (req as any)?.body;

      // Déjà parsé (objet non vide)
      if (body && typeof body === 'object' && !Buffer.isBuffer(body) && Object.keys(body).length > 0) {
        return resolve(body);
      }

      // Buffer (cas Netlify)
      if (Buffer.isBuffer(body)) {
        try {
          const bodyString = body.toString('utf8');
          const parsed = bodyString ? JSON.parse(bodyString) : {};
          return resolve(parsed);
        } catch {
          return reject(new Error('Invalid JSON from Buffer'));
        }
      }

      // Objet vide
      if (body && typeof body === 'object' && Object.keys(body).length === 0) {
        return resolve({});
      }

      // Fallback: lecture du stream
      let data = '';
      (req as IncomingMessage).on('data', chunk => { data += chunk.toString(); });
      (req as IncomingMessage).on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch {
          reject(new Error('Invalid JSON'));
        }
      });
      (req as IncomingMessage).on('error', reject);
    } catch (e) {
      reject(e);
    }
  });
}

function getSalonId(req: any): string {
  const id = (req.params && typeof req.params.salonId === "string" && req.params.salonId) || "main";
  return id.toLowerCase();
}

// Cache pour les settings (évite les requêtes répétées à la base de données)
const settingsCache = new Map<string, { data: ISettings; expiry: number }>();
const SETTINGS_CACHE_TTL = 30000; // 30 secondes

async function getSettings(salonId: string): Promise<ISettings> {
  // Vérifier le cache d'abord
  const cached = settingsCache.get(salonId);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  let settings = await Settings.findOne({ salonId });
  if (!settings) {
    settings = new Settings({
      salonId,
      loginPasswordHash: null,
      adminCodeHash: null,
      adminToken: null,
      adminEmail: null,
      salonName: null,
      salonAddress: null,
      salonPostalCode: null,
      salonCity: null,
      salonPhone: null,
      resetCode: null,
      resetExpiresAt: 0,
      loyaltyPercentDefault: 5,
      paymentModes: ["cash", "check", "card"],
      commissionDefault: 50,
      pointsRedeemDefault: 10,
    });
    // ⚠️ IMPORTANT : Ne PAS sauvegarder automatiquement le salon s'il n'existe pas.
    // Cela évite la création de comptes fantômes vides (ghost accounts) lors d'accès par URL ou scan.
    // Le salon sera créé uniquement via setupAdminAccount (inscription).
    // await settings.save();
  }

  if (settings.pointsRedeemDefault === 100) {
    settings.pointsRedeemDefault = 10;
    await settings.save();
  }

  // Mettre en cache
  settingsCache.set(salonId, { data: settings, expiry: Date.now() + SETTINGS_CACHE_TTL });

  return settings;
}

// Fonction pour invalider le cache (appelée après modification des settings)
function invalidateSettingsCache(salonId: string) {
  settingsCache.delete(salonId);
}

// Helper functions
function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

function makeToken() {
  return randomBytes(16).toString("hex");
}

async function isAdmin(req: any): Promise<boolean> {
  const settings = await getSettings(getSalonId(req));
  const token = req.header("x-admin-token");
  return Boolean(settings.adminToken && token && token === settings.adminToken);
}

async function requireAdmin(req: any, res: any): Promise<boolean> {
  if (!(await isAdmin(req))) {
    res.status(401).json({ error: "admin authorization required" });
    return false;
  }
  return true;
}

// Europe/Paris-aware helpers
function tzOffsetMinutes(timeZone: string, at: number) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(new Date(at));
  const name = parts.find(p => p.type === "timeZoneName")?.value || "UTC";
  const m = name.match(/([+-]\d{1,2})(?::?(\d{2}))?/);
  if (!m) return 0;
  const sign = m[1].startsWith("-") ? -1 : 1;
  const hours = Math.abs(parseInt(m[1], 10));
  const minutes = m[2] ? parseInt(m[2], 10) : 0;
  return sign * (hours * 60 + minutes);
}

function parisYMD(at: number) {
  const parts = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(at));
  const get = (t: string) => parts.find(p => p.type === t)?.value || "";
  return { y: Number(get("year")), m: Number(get("month")), d: Number(get("day")) };
}

function formatParisISODate(at: number) {
  const { y, m, d } = parisYMD(at);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function startOfDayParis(at: number) {
  const { y, m, d } = parisYMD(at);
  let guess = Date.UTC(y, m - 1, d, 0, 0);
  let off = tzOffsetMinutes("Europe/Paris", guess);
  let ts = guess - off * 60 * 1000;
  off = tzOffsetMinutes("Europe/Paris", ts);
  return Date.UTC(y, m - 1, d, 0, 0) - off * 60 * 1000;
}

function isSameMonthParis(a: number, b: number) {
  const pa = parisYMD(a);
  const pb = parisYMD(b);
  return pa.y === pb.y && pa.m === pb.m;
}

function clampCommission(value: number) {
  return Math.max(0, Math.min(100, value));
}

function sanitizePdfText(value: string) {
  return value
    .replace(/[]/g, "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[€]/g, "EUR")
    .replace(/�/g, "");
}

function sanitizePdfRow(values: string[]) {
  return values.map((text) => sanitizePdfText(text));
}

function splitNameParts(fullName: string | null | undefined) {
  const value = (fullName ?? "").trim();
  if (!value) {
    return { firstName: "", lastName: "" };
  }
  const parts = value.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

// Fonctions d'agrégation mises à jour pour MongoDB
async function aggregateForStylist(stylistId: string, salonId: string) {
  const now = Date.now();
  const todayStart = startOfDayParis(now);

  const [prestations, products, redemptions] = await Promise.all([
    Prestation.find({ salonId, stylistId }),
    Product.find({ salonId, stylistId }),
    PointsRedemption.find({ salonId, stylistId })
  ]);

  let dailyAmount = 0;
  let dailyCount = 0;
  let monthlyAmount = 0;
  let monthlyCount = 0;
  let dailyProductAmount = 0;
  let dailyProductCount = 0;
  let monthlyProductAmount = 0;
  let monthlyProductCount = 0;
  let dailyPointsUsed = 0;
  let monthlyPointsUsed = 0;

  for (const p of prestations) {
    if (startOfDayParis(p.timestamp) === todayStart) {
      dailyAmount += p.amount;
      dailyCount++;
    }
    if (isSameMonthParis(p.timestamp, now)) {
      monthlyAmount += p.amount;
      monthlyCount++;
    }
  }

  for (const prod of products) {
    if (startOfDayParis(prod.timestamp) === todayStart) {
      dailyProductAmount += prod.amount;
      dailyProductCount++;
    }
    if (isSameMonthParis(prod.timestamp, now)) {
      monthlyProductAmount += prod.amount;
      monthlyProductCount++;
    }
  }

  for (const usage of redemptions) {
    if (startOfDayParis(usage.timestamp) === todayStart) {
      dailyPointsUsed += usage.points;
    }
    if (isSameMonthParis(usage.timestamp, now)) {
      monthlyPointsUsed += usage.points;
    }
  }

  return {
    dailyAmount: dailyAmount + dailyProductAmount,
    dailyCount: dailyCount + dailyProductCount,
    monthlyAmount: monthlyAmount + monthlyProductAmount,
    monthlyCount: monthlyCount + monthlyProductCount,
    dailyPointsUsed,
    monthlyPointsUsed,
    dailyPrestationAmount: dailyAmount,
    monthlyPrestationAmount: monthlyAmount,
    dailyProductAmount,
    monthlyProductAmount,
    dailyProductCount,
    monthlyProductCount,
  };
}

function emptyBreakdown() {
  return { amount: 0, count: 0 };
}

function makeScope() {
  return {
    total: { amount: 0, count: 0 },
    methods: {
      cash: emptyBreakdown(),
      check: emptyBreakdown(),
      card: emptyBreakdown(),
      mixed: emptyBreakdown(),
    } as Record<PaymentMethod, { amount: number; count: number }>,
  };
}



interface HiddenPeriod {
  month: number;
  startDay: number;
  endDay: number;
}

function isTimestampInHiddenPeriod(timestamp: number, hiddenPeriods: HiddenPeriod[]): boolean {
  if (!hiddenPeriods || hiddenPeriods.length === 0) return false;

  const date = new Date(timestamp);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10);
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
  const monthInt = year * 100 + month;

  const period = hiddenPeriods.find(p => p.month === monthInt);
  if (!period) return false;

  const start = Math.min(period.startDay, period.endDay);
  const end = Math.max(period.startDay, period.endDay);
  return day >= start && day <= end;
}

async function aggregateByPayment(salonId: string, stylistId: string, refNowMs: number = Date.now(), startDateMs?: number, endDateMs?: number, hiddenPeriods: HiddenPeriod[] = []) {
  const now = refNowMs;
  const todayStart = startOfDayParis(now);
  const useRange = typeof startDateMs === 'number' && typeof endDateMs === 'number';

  const [prestations, products] = await Promise.all([
    Prestation.find({ salonId, stylistId }),
    Product.find({ salonId, stylistId })
  ]);

  const daily = makeScope();
  const monthly = makeScope();
  const range = makeScope();
  const prestationDaily = makeScope();
  const prestationMonthly = makeScope();
  const prestationRange = makeScope();
  const dailyEntries: { id: string; amount: number; paymentMethod: PaymentMethod; timestamp: number; kind: "prestation" | "produit"; name?: string; mixedCardAmount?: number; mixedCashAmount?: number }[] = [];
  const rangeEntries: { id: string; amount: number; paymentMethod: PaymentMethod; timestamp: number; kind: "prestation" | "produit"; name?: string; mixedCardAmount?: number; mixedCashAmount?: number }[] = [];
  let rangeProductCount = 0;

  let dailyTipCountStylist = 0;
  let monthlyTipCountStylist = 0;
  let rangeTipCountStylist = 0;
  let dailyTipAmount = 0;
  let monthlyTipAmount = 0;
  let rangeTipAmount = 0;
  let dailyNonCashTipAmount = 0;
  let monthlyNonCashTipAmount = 0;
  let rangeNonCashTipAmount = 0;

  for (const p of prestations) {
    const isHidden = isTimestampInHiddenPeriod(p.timestamp, hiddenPeriods);
    const isTip = p.serviceName === "Pourboire";
    const method = p.paymentMethod as PaymentMethod;
    const isCashTip = isTip && method === "cash";

    const inc = (scope: ReturnType<typeof makeScope>) => {
      if (!isCashTip) {
        scope.total.amount += p.amount;
      }
      if (!isTip) {
        scope.total.count += 1;
      }
      if (method === "mixed" && (p as any).mixedCardAmount && (p as any).mixedCashAmount) {
        scope.methods.card.amount += (p as any).mixedCardAmount;
        scope.methods.cash.amount += (p as any).mixedCashAmount;
        scope.methods.mixed.count += 1;
      } else if (scope.methods[method]) {
        if (!isCashTip) {
          scope.methods[method].amount += p.amount;
        }
        scope.methods[method].count += 1;
      }
    };

    if (startOfDayParis(p.timestamp) === todayStart && !isHidden) {
      inc(daily);
      inc(prestationDaily);
      if (isTip) {
        dailyTipCountStylist++;
        dailyTipAmount += p.amount;
        if (!isCashTip) {
          dailyNonCashTipAmount += p.amount;
        }
      }
      dailyEntries.push({
        id: p.id,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
        timestamp: p.timestamp,
        kind: "prestation",
        name: p.serviceName,
        mixedCardAmount: (p as any).mixedCardAmount,
        mixedCashAmount: (p as any).mixedCashAmount
      });
    }
    if (isSameMonthParis(p.timestamp, now) && !isHidden) {
      inc(monthly);
      inc(prestationMonthly);
      if (isTip) {
        monthlyTipCountStylist++;
        monthlyTipAmount += p.amount;
        if (!isCashTip) {
          monthlyNonCashTipAmount += p.amount;
        }
      }
    }
    if (useRange && p.timestamp >= startDateMs! && p.timestamp <= endDateMs! && !isHidden) {
      inc(range);
      inc(prestationRange);
      if (isTip) {
        rangeTipCountStylist++;
        rangeTipAmount += p.amount;
        if (!isCashTip) {
          rangeNonCashTipAmount += p.amount;
        }
      }
      rangeEntries.push({
        id: p.id,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
        timestamp: p.timestamp,
        kind: "prestation",
        name: p.serviceName,
        mixedCardAmount: (p as any).mixedCardAmount,
        mixedCashAmount: (p as any).mixedCashAmount
      });
    }
  }

  for (const prod of products) {
    const isHidden = isTimestampInHiddenPeriod(prod.timestamp, hiddenPeriods);

    const incAmount = (scope: ReturnType<typeof makeScope>) => {
      scope.total.amount += prod.amount;
      const method = prod.paymentMethod as PaymentMethod;
      if (method === "mixed" && (prod as any).mixedCardAmount && (prod as any).mixedCashAmount) {
        scope.methods.card.amount += (prod as any).mixedCardAmount;
        scope.methods.cash.amount += (prod as any).mixedCashAmount;
      } else if (scope.methods[method]) {
        scope.methods[method].amount += prod.amount;
      }
    };

    if (startOfDayParis(prod.timestamp) === todayStart && !isHidden) {
      incAmount(daily);
      dailyEntries.push({
        id: prod.id,
        amount: prod.amount,
        paymentMethod: prod.paymentMethod,
        timestamp: prod.timestamp,
        kind: "produit",
        name: prod.productName,
        mixedCardAmount: (prod as any).mixedCardAmount,
        mixedCashAmount: (prod as any).mixedCashAmount
      });
    }
    if (isSameMonthParis(prod.timestamp, now) && !isHidden) incAmount(monthly);
    if (useRange && prod.timestamp >= startDateMs! && prod.timestamp <= endDateMs! && !isHidden) {
      incAmount(range);
      rangeProductCount++;
      rangeEntries.push({
        id: prod.id,
        amount: prod.amount,
        paymentMethod: prod.paymentMethod,
        timestamp: prod.timestamp,
        kind: "produit",
        name: prod.productName,
        mixedCardAmount: (prod as any).mixedCardAmount,
        mixedCashAmount: (prod as any).mixedCashAmount
      });
    }
  }

  dailyEntries.sort((a, b) => b.timestamp - a.timestamp);
  rangeEntries.sort((a, b) => b.timestamp - a.timestamp);

  let dailyProductCount = 0;
  let monthlyProductCount = 0;

  for (const prod of products) {
    const isHidden = isTimestampInHiddenPeriod(prod.timestamp, hiddenPeriods);
    if (startOfDayParis(prod.timestamp) === todayStart && !isHidden) {
      dailyProductCount++;
    }
    if (isSameMonthParis(prod.timestamp, now) && !isHidden) {
      monthlyProductCount++;
    }
  }

  return { daily, monthly, range, prestationDaily, prestationMonthly, prestationRange, dailyEntries, rangeEntries, dailyProductCount, monthlyProductCount, rangeProductCount, dailyTipCount: dailyTipCountStylist, monthlyTipCount: monthlyTipCountStylist, rangeTipCount: rangeTipCountStylist, dailyTipAmount, monthlyTipAmount, rangeTipAmount, dailyNonCashTipAmount, monthlyNonCashTipAmount, rangeNonCashTipAmount };
}

async function aggregateAllPayments(salonId: string) {
  const now = Date.now();
  const todayStart = startOfDayParis(now);

  const [prestations, products] = await Promise.all([
    Prestation.find({ salonId }),
    Product.find({ salonId })
  ]);

  const daily = makeScope();
  const monthly = makeScope();

  for (const p of prestations) {
    const isTip = p.serviceName === "Pourboire";
    if (isTip) continue;

    const inc = (scope: ReturnType<typeof makeScope>) => {
      scope.total.amount += p.amount;
      scope.total.count += 1;
      const method = p.paymentMethod as PaymentMethod;
      if (method === "mixed" && (p as any).mixedCardAmount && (p as any).mixedCashAmount) {
        scope.methods.card.amount += (p as any).mixedCardAmount;
        scope.methods.cash.amount += (p as any).mixedCashAmount;
        scope.methods.mixed.count += 1;
      } else if (scope.methods[method]) {
        scope.methods[method].amount += p.amount;
        scope.methods[method].count += 1;
      }
    };

    if (startOfDayParis(p.timestamp) === todayStart) inc(daily);
    if (isSameMonthParis(p.timestamp, now)) inc(monthly);
  }

  for (const prod of products) {
    const incAmount = (scope: ReturnType<typeof makeScope>) => {
      scope.total.amount += prod.amount;
      const method = prod.paymentMethod as PaymentMethod;
      if (method === "mixed" && (prod as any).mixedCardAmount && (prod as any).mixedCashAmount) {
        scope.methods.card.amount += (prod as any).mixedCardAmount;
        scope.methods.cash.amount += (prod as any).mixedCashAmount;
      } else if (scope.methods[method]) {
        scope.methods[method].amount += prod.amount;
      }
    };

    if (startOfDayParis(prod.timestamp) === todayStart) incAmount(daily);
    if (isSameMonthParis(prod.timestamp, now)) incAmount(monthly);
  }

  return { daily, monthly };
}

// Interfaces pour les rapports
interface PointsUsageEntry {
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

interface PointsUsageGroup {
  stylistId: string;
  stylistName: string;
  totalPoints: number;
  entries: PointsUsageEntry[];
}

async function collectPointsUsage(salonId: string, options: { dayRef: number; monthRef: number; generatedAt?: number }) {
  const { dayRef, monthRef, generatedAt } = options;
  const daily = new Map<string, PointsUsageGroup>();
  const monthly = new Map<string, PointsUsageGroup>();
  const dayStart = startOfDayParis(dayRef);

  const [redemptions, stylists, clients] = await Promise.all([
    PointsRedemption.find({ salonId }),
    Stylist.find({ salonId }),
    Client.find({ salonId })
  ]);

  const clientMap = new Map(clients.map(c => [c.id, c]));
  const stylistMap = new Map(stylists.map(s => [s.id, s]));

  const register = (registry: Map<string, PointsUsageGroup>, stylistId: string, stylistName: string, entry: PointsUsageEntry) => {
    let bucket = registry.get(stylistId);
    if (!bucket) {
      bucket = { stylistId, stylistName, totalPoints: 0, entries: [] };
      registry.set(stylistId, bucket);
    }
    bucket.entries.push(entry);
    bucket.totalPoints += entry.points;
  };

  for (const usage of redemptions) {
    const stylist = stylistMap.get(usage.stylistId);
    if (!stylist) continue;

    const client = clientMap.get(usage.clientId) || null;
    const clientName = client?.name?.trim() || "Client inconnu";
    const { firstName, lastName } = splitNameParts(client?.name ?? "");

    const entry: PointsUsageEntry = {
      id: usage.id,
      clientId: usage.clientId,
      points: usage.points,
      timestamp: usage.timestamp,
      reason: usage.reason,
      clientName,
      firstName,
      lastName,
      email: client?.email ?? null,
      phone: client?.phone ?? null,
    };

    if (startOfDayParis(usage.timestamp) === dayStart) {
      register(daily, stylist.id, stylist.name, entry);
    }
    if (isSameMonthParis(usage.timestamp, monthRef)) {
      register(monthly, stylist.id, stylist.name, entry);
    }
  }

  const sortEntries = (registry: Map<string, PointsUsageGroup>): PointsUsageGroup[] =>
    Array.from(registry.values())
      .map((group) => ({
        ...group,
        entries: [...group.entries].sort((a, b) => b.timestamp - a.timestamp),
      }))
      .sort((a, b) => a.stylistName.localeCompare(b.stylistName, "fr-FR", { sensitivity: "base" }));

  return {
    daily: sortEntries(daily),
    monthly: sortEntries(monthly),
    generatedAt: generatedAt ?? Date.now(),
  };
}

// Contrôleurs
export const listStylists: RequestHandler = async (req, res) => {
  try {
    const salonId = getSalonId(req);
    const stylists = await Stylist.find({ salonId });

    const stylistsWithStats = await Promise.all(
      stylists.map(async (s) => ({
        ...s.toObject(),
        stats: await aggregateForStylist(s.id, salonId)
      }))
    );

    res.json({ stylists: stylistsWithStats });
  } catch (error) {
    console.error('Error listing stylists:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const getStylistsByPriority: RequestHandler = async (req, res) => {
  try {
    const salonId = getSalonId(req);
    const settings = await getSettings(salonId);

    if (!settings.showStylistPriority) {
      return res.json({ stylists: [], enabled: false });
    }

    const stylists = await Stylist.find({ salonId });

    const stylistsWithLastPrestation = await Promise.all(
      stylists.map(async (s) => {
        const lastPrestation = await Prestation.findOne({ stylistId: s.id, salonId })
          .sort({ createdAt: -1, timestamp: -1 })
          .limit(1);
        const createdAtValue = lastPrestation?.createdAt;
        const timestampValue = lastPrestation?.timestamp;
        let lastTs = 0;
        if (createdAtValue) {
          lastTs = createdAtValue instanceof Date ? createdAtValue.getTime() : (typeof createdAtValue === 'number' ? createdAtValue : new Date(createdAtValue).getTime());
        } else if (typeof timestampValue === 'number') {
          lastTs = timestampValue;
        }
        return {
          id: s.id,
          name: s.name,
          lastPrestationTimestamp: lastTs
        };
      })
    );

    // Tri ascendant : le coiffeur avec la prestation la plus ancienne (ou sans prestation) est en premier
    const sortedStylists = stylistsWithLastPrestation
      .sort((a, b) => a.lastPrestationTimestamp - b.lastPrestationTimestamp);

    res.json({ stylists: sortedStylists, enabled: true });
  } catch (error) {
    console.error('Error getting stylists by priority:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const getConfig: RequestHandler = async (req, res) => {
  try {
    const salonId = getSalonId(req);
    const settings = await getSettings(salonId);
    const admin = await isAdmin(req);
    const now = Date.now();
    let mutated = false;

    // ⭐️ RÉINTÉGRATION : Logique de gestion du trial
    if (TRIAL_DURATION_MS > 0) {
      const hasStripeSubscription = Boolean(settings.stripeSubscriptionId && settings.stripeSubscriptionId.startsWith("sub_"));
      const trialEndsAt = typeof settings.trialEndsAt === "number" ? settings.trialEndsAt : null;
      const trialActive = Boolean(trialEndsAt && trialEndsAt > now);

      if (!hasStripeSubscription && trialActive) {
        // Only force trialing if we are NOT already active/paid (e.g. granted by admin or legacy)
        if (settings.subscriptionStatus !== "trialing" && settings.subscriptionStatus !== "active" && settings.subscriptionStatus !== "paid") {
          settings.subscriptionStatus = "trialing";
          mutated = true;
        }
        if (settings.subscriptionCurrentPeriodEnd !== trialEndsAt) {
          settings.subscriptionCurrentPeriodEnd = trialEndsAt;
          mutated = true;
        }
      }

      if (!hasStripeSubscription && !trialActive && trialEndsAt) {
        if (settings.subscriptionStatus === "trialing" || !settings.subscriptionStatus) {
          settings.subscriptionStatus = "trial_expired";
          mutated = true;
        }
        if (settings.subscriptionCurrentPeriodEnd !== trialEndsAt) {
          settings.subscriptionCurrentPeriodEnd = trialEndsAt;
          mutated = true;
        }
      }
    }

    if (mutated) {
      await settings.save();
      invalidateSettingsCache(salonId);
    }

    res.json({
      loyaltyPercentDefault: settings.loyaltyPercentDefault,
      paymentModes: settings.paymentModes,
      commissionDefault: settings.commissionDefault,
      pointsRedeemDefault: settings.pointsRedeemDefault,
      adminSet: settings.loginPasswordHash != null,
      adminCodeSet: settings.adminCodeHash != null,
      isAdmin: admin,
      accountEmail: settings.accountEmail, // Email de connexion
      adminEmail: settings.adminEmail, // Email de récupération
      salonName: settings.salonName,
      salonAddress: settings.salonAddress,
      salonPostalCode: settings.salonPostalCode,
      salonCity: settings.salonCity,
      salonPhone: settings.salonPhone,
      // Subscription status (if using Stripe)
      stripeCustomerId: settings.stripeCustomerId ?? null,
      stripeSubscriptionId: settings.stripeSubscriptionId ?? null,
      subscriptionStatus: settings.subscriptionStatus ?? null,
      subscriptionCurrentPeriodEnd: settings.subscriptionCurrentPeriodEnd ?? null,
      // ⭐️ RÉINTÉGRATION : Champs de trial
      trialStartedAt: settings.trialStartedAt ?? null,
      trialEndsAt: settings.trialEndsAt ?? null,
      showStylistPriority: settings.showStylistPriority ?? false,
      hideTotalCA: settings.hideTotalCA ?? false,
      currency: settings.currency ?? "EUR",
    });
  } catch (error) {
    console.error('Error getting config:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const setupAdminAccount: RequestHandler = async (req, res) => {
  try {
    const body = await parseRequestBody(req);
    const salonId = getSalonId(req);
    const { password, adminCode, email, salonName, salonAddress, salonPostalCode, salonCity, salonPhone } = body as {
      password?: string;
      adminCode?: string;
      email?: string;
      salonName?: string;
      salonAddress?: string;
      salonPostalCode?: string;
      salonCity?: string;
      salonPhone?: string;
    };

    const loginPassword = (password ?? "").toString().trim();
    const code = (adminCode ?? "").toString().trim();
    const emailValue = (email ?? "").toString().trim().toLowerCase();
    const name = (salonName ?? "").toString().trim();
    const address = (salonAddress ?? "").toString().trim();
    const postalCode = (salonPostalCode ?? "").toString().trim();
    const city = (salonCity ?? "").toString().trim();
    const phone = (salonPhone ?? "").toString().trim();

    if (!loginPassword || loginPassword.length < 4) return res.status(400).json({ error: "mot de passe trop court" });
    if (loginPassword.toLowerCase() === "admin") return res.status(400).json({ error: "le mot de passe ne peut pas être admin" });
    if (code && code.length > 0) {
      if (code.length < 4) return res.status(400).json({ error: "code admin trop court" });
      if (code.toLowerCase() === "admin") return res.status(400).json({ error: "le code admin ne peut pas être admin" });
      if (loginPassword === code) return res.status(400).json({ error: "mot de passe et code admin doivent être différents" });
    }
    if (!emailValue || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailValue)) return res.status(400).json({ error: "email valide requis" });
    if (!name) return res.status(400).json({ error: "nom du salon requis" });
    if (!address) return res.status(400).json({ error: "adresse du salon requise" });
    if (!postalCode || !/^\d{5}$/.test(postalCode)) return res.status(400).json({ error: "code postal invalide" });
    if (!city) return res.status(400).json({ error: "ville requise" });
    if (!phone || !/^[+\d][0-9\s().-]{5,}$/.test(phone)) return res.status(400).json({ error: "téléphone du salon invalide" });

    const existingSettings = await Settings.findOne({ adminEmail: emailValue });
    if (existingSettings) {
      return res.status(400).json({ error: "un compte avec cet email existe déjà" });
    }

    const currentSettings = await getSettings(salonId);
    if (currentSettings.loginPasswordHash) {
      return res.status(400).json({ error: "ce salon a déjà un compte configuré" });
    }

    const updates: any = {
      loginPasswordHash: sha256(loginPassword),
      adminCodeHash: code ? sha256(code) : null,
      accountEmail: emailValue, // Email de connexion (immutable)
      adminEmail: emailValue, // Email de récupération (initialisé identique)
      salonName: name,
      salonAddress: address,
      salonPostalCode: postalCode,
      salonCity: city,
      salonPhone: phone,
      adminToken: makeToken(),
    };

    // ⭐️ RÉINTÉGRATION : Initialisation du trial
    if (TRIAL_DURATION_MS > 0) {
      const now = Date.now();
      const trialEndsAt = now + TRIAL_DURATION_MS;
      updates.trialStartedAt = now;
      updates.trialEndsAt = trialEndsAt;
      updates.subscriptionStatus = "trialing";
      updates.subscriptionCurrentPeriodEnd = trialEndsAt;
    } else {
      updates.trialStartedAt = null;
      updates.trialEndsAt = null;
    }

    const settings = await Settings.findOneAndUpdate(
      { salonId },
      { $set: updates },
      { new: true, upsert: true }
    );

    emailToSalonId.set(emailValue, salonId);

    res.json({ token: settings.adminToken });
  } catch (error) {
    console.error('Error setting up admin account:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const adminLogin: RequestHandler = async (req, res) => {
  try {
    const body = await parseRequestBody(req);
    const { email, password } = body as { email?: string; password?: string };
    const e = (email ?? "").toString().trim().toLowerCase();
    if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return res.status(400).json({ error: "valid email required" });
    if (!password) return res.status(400).json({ error: "password required" });

    const passwordHash = sha256(password);

    let foundSalonId: string | null = null;
    let foundSettings: ISettings | null = null;

    // 1. Chercher par accountEmail (nouveau standard)
    let settings = await Settings.findOne({ accountEmail: e, loginPasswordHash: passwordHash });

    // 2. Fallback: Chercher par adminEmail (pour compatibilité avant migration)
    if (!settings) {
      settings = await Settings.findOne({ adminEmail: e, loginPasswordHash: passwordHash });

      if (settings) {
        // Si accountEmail est déjà défini, on ne permet PAS la connexion via adminEmail
        // (Cela signifie que c'est un compte moderne/migré et l'utilisateur doit utiliser son accountEmail)
        if (settings.accountEmail) {
          settings = null;
        } else {
          // Migration à la volée si trouvé par adminEmail ET accountEmail non défini
          console.log(`🔄 Migration accountEmail pour salon ${settings.salonId}`);
          settings.accountEmail = settings.adminEmail || e;
          await settings.save();
        }
      }
    }

    if (settings) {
      foundSalonId = settings.salonId;
      foundSettings = settings;
    }

    if (!foundSalonId) {
      const cachedSalonId = emailToSalonId.get(e);
      if (cachedSalonId) {
        const settings = await getSettings(cachedSalonId);
        if (settings.loginPasswordHash === passwordHash) {
          foundSalonId = cachedSalonId;
          foundSettings = settings;
        }
      }
    }

    if (!foundSalonId || !foundSettings) {
      return res.status(401).json({ error: "invalid email or password" });
    }

    // Réutiliser le token existant pour permettre les connexions simultanées
    // Ne générer un nouveau token que s'il n'existe pas
    if (!foundSettings.adminToken) {
      foundSettings.adminToken = makeToken();
      await foundSettings.save();
    }
    emailToSalonId.set(e, foundSalonId);

    return res.json({ token: foundSettings.adminToken, salonId: foundSalonId });
  } catch (error) {
    console.error('Error in admin login:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const verifyAdminCode: RequestHandler = async (req, res) => {
  try {
    const body = await parseRequestBody(req);
    const salonId = getSalonId(req);
    const settings = await getSettings(salonId);
    const { code } = body as { code?: string };
    const value = (code ?? "").toString().trim();
    if (!settings.adminCodeHash) return res.status(400).json({ error: "code admin non configuré" });
    if (!value) return res.status(400).json({ error: "code requis" });
    if (sha256(value) !== settings.adminCodeHash) return res.status(401).json({ error: "code invalide" });
    // Réutiliser le token existant pour permettre les connexions simultanées
    if (!settings.adminToken) {
      settings.adminToken = makeToken();
      await settings.save();
    }
    return res.json({ token: settings.adminToken, salonId });
  } catch (error) {
    console.error('Error verifying admin code:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const setAdminPassword: RequestHandler = async (req, res) => {
  try {
    const body = await parseRequestBody(req);
    const salonId = getSalonId(req);
    const settings = await getSettings(salonId);
    const { password, currentPassword, email } = body as {
      password?: string;
      currentPassword?: string;
      email?: string;
    };

    if (!settings.loginPasswordHash) {
      return res.status(400).json({ error: "Compte non configuré" });
    }

    const newCode = (password ?? "").toString().trim();
    const currentCode = (currentPassword ?? "").toString().trim();
    const nextEmail = (email ?? "").toString().trim().toLowerCase();

    if (!newCode || newCode.length < 4) {
      return res.status(400).json({ error: "Le code admin doit contenir au moins 4 caractères" });
    }

    if (newCode.toLowerCase() === "admin") {
      return res.status(400).json({ error: "Le code admin ne peut pas être 'admin'" });
    }

    // Vérifier le mot de passe actuel (loginPasswordHash)
    if (settings.adminCodeHash) {
      if (!currentCode) {
        return res.status(401).json({ error: "Code actuel requis" });
      }
      if (sha256(currentCode) !== settings.adminCodeHash) {
        return res.status(401).json({ error: "Code actuel incorrect" });
      }
    }

    if (!settings.adminEmail && !nextEmail) {
      return res.status(400).json({ error: "Email requis" });
    }

    if (nextEmail) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(nextEmail)) {
        return res.status(400).json({ error: "Adresse email valide requise" });
      }
      settings.adminEmail = nextEmail;
    }

    // Mettre à jour adminCodeHash (code admin) et loginPasswordHash (mot de passe connexion)
    settings.adminCodeHash = sha256(newCode);
    // Si vous voulez aussi changer le mot de passe de connexion :
    // settings.loginPasswordHash = sha256(newCode); 

    settings.adminToken = makeToken();
    await settings.save();

    res.json({ token: settings.adminToken, salonId });

  } catch (error) {
    console.error('Error setting admin password:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

async function sendRecoveryEmail(to: string, code: string) {
  const hook = process.env.ADMIN_RESET_WEBHOOK_URL;
  if (!hook) return false;
  const subject = "Code de récupération admin";
  const text = `Votre code de récupération est: ${code}. Il expire dans 10 minutes.`;
  const html = `<p>Votre code de récupération est: <strong>${code}</strong>.</p><p>Il expire dans 10 minutes.</p>`;
  try {
    await fetch(hook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to, subject, text, html }) });
    return true;
  } catch {
    return false;
  }
}

export const recoverAdminPassword: RequestHandler = async (req, res) => {
  try {
    const body = await parseRequestBody(req);
    const { email } = body as { email?: string };
    const e = (email ?? "").toString().trim().toLowerCase();

    if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
      return res.status(400).json({ error: "Adresse email valide requise" });
    }

    console.log(`🔍 Recherche de compte pour email: ${e}`);

    // Rechercher dans tous les salons l'email correspondant
    let foundSalonId: string | null = null;
    let foundSettings: ISettings | null = null;

    // 1. D'abord chercher dans le cache
    const cachedSalonId = emailToSalonId.get(e);
    if (cachedSalonId) {
      console.log(`📋 Trouvé dans cache: ${cachedSalonId}`);
      const settings = await getSettings(cachedSalonId);
      if (settings.adminEmail && settings.adminEmail.toLowerCase() === e) {
        foundSalonId = cachedSalonId;
        foundSettings = settings;
      }
    }

    // 2. Si pas trouvé dans cache, chercher dans la base de données
    if (!foundSalonId) {
      console.log(`🔍 Recherche en base de données pour: ${e}`);
      // Chercher par adminEmail (récupération) OU accountEmail (fallback)
      const settings = await Settings.findOne({
        $or: [
          { adminEmail: { $regex: new RegExp(`^${e}$`, 'i') } },
          { accountEmail: { $regex: new RegExp(`^${e}$`, 'i') } }
        ]
      });

      if (settings) {
        foundSalonId = settings.salonId;
        foundSettings = settings;
        console.log(`✅ Trouvé en base: ${foundSalonId}`);

        // Mettre à jour le cache pour la prochaine fois
        emailToSalonId.set(e, foundSalonId);
      }
    }

    if (!foundSalonId || !foundSettings) {
      console.log(`❌ Aucun compte trouvé pour: ${e}`);
      return res.status(401).json({ error: "Aucun compte trouvé avec cet email" });
    }

    // Vérifier que l'email de récupération est configuré
    if (!foundSettings.adminEmail) {
      console.log(`❌ Aucun email admin configuré pour: ${foundSalonId}`);
      return res.status(400).json({ error: "Aucun email de récupération configuré" });
    }

    // Vérifier la correspondance exacte de l'email (case insensitive)
    const targetEmail = (foundSettings.adminEmail || foundSettings.accountEmail || "").toLowerCase();
    if (targetEmail !== e) {
      console.log(`❌ Email non reconnu: ${e} vs ${targetEmail}`);
      return res.status(401).json({ error: "Email non reconnu" });
    }

    // Générer un code à 6 chiffres
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // Sauvegarder le code et la date d'expiration
    foundSettings.resetCode = code;
    foundSettings.resetExpiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    await foundSettings.save();

    // Envoyer l'email avec SendGrid
    const salonName = foundSettings.salonName || 'Votre Salon';
    const emailed = await EmailService.sendPasswordResetCode(e, code, salonName);

    if (emailed) {
      console.log(`✅ Code de récupération envoyé à: ${e} (salon: ${foundSalonId})`);
      return res.json({
        ok: true,
        message: "Code de récupération envoyé par email",
        emailed: true
      });
    } else {
      console.error(`❌ Échec envoi email à: ${e}`);
      return res.status(500).json({
        error: "Erreur lors de l'envoi de l'email. Veuillez réessayer."
      });
    }

  } catch (error) {
    console.error('Error recovering admin password:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const recoverAdminVerify: RequestHandler = async (req, res) => {
  try {
    const body = await parseRequestBody(req);
    const { email, code, newPassword } = body as { email?: string; code?: string; newPassword?: string };
    const e = (email ?? "").toString().trim().toLowerCase();
    const c = (code ?? "").toString().trim();
    const pwd = (newPassword ?? "").toString().trim();

    if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
      return res.status(400).json({ error: "Adresse email valide requise" });
    }

    if (!pwd || pwd.length < 4) {
      return res.status(400).json({ error: "Le mot de passe doit contenir au moins 4 caractères" });
    }

    if (pwd.toLowerCase() === "admin") {
      return res.status(400).json({ error: "Le mot de passe ne peut pas être 'admin'" });
    }

    const salonId = emailToSalonId.get(e);
    if (!salonId) {
      return res.status(401).json({ error: "Aucun compte trouvé avec cet email" });
    }

    const settings = await getSettings(salonId);

    if (!settings.adminEmail) {
      return res.status(400).json({ error: "Aucun email de récupération configuré" });
    }

    if (settings.adminEmail.toLowerCase() !== e) {
      return res.status(401).json({ error: "Email non reconnu" });
    }

    if (!settings.resetCode || !settings.resetExpiresAt || Date.now() > settings.resetExpiresAt) {
      return res.status(400).json({ error: "Code expiré ou invalide" });
    }

    if (settings.resetCode !== c) {
      return res.status(401).json({ error: "Code incorrect" });
    }

    // ⭐️ CORRECTION ICI : Mettre à jour loginPasswordHash au lieu de adminCodeHash
    settings.loginPasswordHash = sha256(pwd); // Mot de passe de connexion
    settings.resetCode = null;
    settings.resetExpiresAt = 0;
    settings.adminToken = makeToken();

    await settings.save();

    console.log(`✅ Mot de passe réinitialisé pour: ${e}`);

    return res.json({
      token: settings.adminToken,
      salonId,
      message: "Mot de passe réinitialisé avec succès"
    });

  } catch (error) {
    console.error('Error in recover admin verify:', error);
    res.status(500).json({ error: "Erreur serveur lors de la réinitialisation" });
  }
};

export const recoverAdminCode: RequestHandler = async (req, res) => {
  try {
    const body = await parseRequestBody(req);
    const { email } = body as { email?: string };
    const e = (email ?? "").toString().trim().toLowerCase();

    if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
      return res.status(400).json({ error: "Adresse email valide requise" });
    }

    console.log(`🔍 Recherche de compte pour récupération code admin: ${e}`);

    // RECHERCHE ROBUSTE EN BASE DE DONNÉES
    let foundSalonId: string | null = null;
    let foundSettings: ISettings | null = null;

    // 1. Recherche dans tous les salons
    const allSettings = await Settings.find({});
    console.log(`📊 Recherche parmi ${allSettings.length} salons`);

    for (const setting of allSettings) {
      if (setting.adminEmail && setting.adminEmail.toLowerCase() === e) {
        foundSalonId = setting.salonId;
        foundSettings = setting;
        console.log(`✅ Salon trouvé: ${foundSalonId}`);
        emailToSalonId.set(e, foundSalonId);
        break;
      }
    }

    // 2. Recherche alternative
    if (!foundSalonId) {
      const settings = await Settings.findOne({
        adminEmail: { $regex: new RegExp(`^${e}$`, 'i') }
      });

      if (settings) {
        foundSalonId = settings.salonId;
        foundSettings = settings;
        console.log(`✅ Salon trouvé avec recherche alternative: ${foundSalonId}`);
        emailToSalonId.set(e, foundSalonId);
      }
    }

    if (!foundSalonId || !foundSettings) {
      console.log(`❌ Aucun compte trouvé pour: ${e}`);
      console.log(`📊 Salons disponibles:`, allSettings.map(s => ({
        salonId: s.salonId,
        adminEmail: s.adminEmail,
        hasEmail: !!s.adminEmail
      })));
      return res.status(401).json({ error: "Aucun compte trouvé avec cet email" });
    }

    if (!foundSettings.adminEmail) {
      return res.status(400).json({ error: "Aucun email de récupération configuré" });
    }

    // Vérification exacte de l'email
    if (foundSettings.adminEmail.toLowerCase() !== e) {
      console.log(`❌ Email mismatch: ${e} vs ${foundSettings.adminEmail}`);
      return res.status(401).json({ error: "Email non reconnu" });
    }

    // Génération et envoi du code
    const code = String(Math.floor(100000 + Math.random() * 900000));

    foundSettings.resetCode = code;
    foundSettings.resetExpiresAt = Date.now() + 10 * 60 * 1000;
    await foundSettings.save();

    const salonName = foundSettings.salonName || 'Votre Salon';
    const emailed = await EmailService.sendAdminCodeRecovery(e, code, salonName);

    if (emailed) {
      console.log(`✅ Code admin de récupération envoyé à: ${e} (salon: ${foundSalonId})`);
      return res.json({
        ok: true,
        message: "Code de récupération du code admin envoyé par email",
        emailed: true
      });
    } else {
      console.error(`❌ Échec envoi email à: ${e}`);
      return res.status(500).json({
        error: "Erreur lors de l'envoi de l'email. Veuillez réessayer."
      });
    }

  } catch (error) {
    console.error('Error recovering admin code:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const verifyAdminCodeRecovery: RequestHandler = async (req, res) => {
  try {
    const body = await parseRequestBody(req);
    const { email, code, newAdminCode } = body as {
      email?: string;
      code?: string;
      newAdminCode?: string;
    };

    const e = (email ?? "").toString().trim().toLowerCase();
    const c = (code ?? "").toString().trim();
    const newCode = (newAdminCode ?? "").toString().trim();

    if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
      return res.status(400).json({ error: "Adresse email valide requise" });
    }

    if (!newCode || newCode.length < 4) {
      return res.status(400).json({ error: "Le code admin doit contenir au moins 4 caractères" });
    }

    if (newCode.toLowerCase() === "admin") {
      return res.status(400).json({ error: "Le code admin ne peut pas être 'admin'" });
    }

    console.log(`🔍 Recherche de compte pour vérification code: ${e}`);

    // RECHERCHE DIRECTE EN BASE DE DONNÉES - CORRECTION
    let foundSalonId: string | null = null;
    let foundSettings: ISettings | null = null;

    // 1. D'abord chercher dans le cache (peut être vide sur Netlify)
    const cachedSalonId = emailToSalonId.get(e);
    if (cachedSalonId) {
      console.log(`📋 Trouvé dans cache: ${cachedSalonId}`);
      const settings = await getSettings(cachedSalonId);
      if (settings.adminEmail && settings.adminEmail.toLowerCase() === e) {
        foundSalonId = cachedSalonId;
        foundSettings = settings;
      }
    }

    // 2. Recherche directe en base de données (IMPORTANT pour Netlify)
    if (!foundSalonId) {
      console.log(`🔍 Recherche en base de données pour: ${e}`);

      // Rechercher TOUS les settings avec cet email
      const allSettings = await Settings.find({});
      console.log(`📊 Nombre total de salons en base: ${allSettings.length}`);

      for (const setting of allSettings) {
        if (setting.adminEmail && setting.adminEmail.toLowerCase() === e) {
          foundSalonId = setting.salonId;
          foundSettings = setting;
          console.log(`✅ Salon trouvé en base: ${foundSalonId}`);

          // Mettre à jour le cache pour les prochains appels
          emailToSalonId.set(e, foundSalonId);
          break;
        }
      }
    }

    // 3. Recherche alternative avec regex (plus permissive)
    if (!foundSalonId) {
      console.log(`🔍 Recherche alternative avec regex pour: ${e}`);
      const settings = await Settings.findOne({
        adminEmail: { $regex: new RegExp(`^${e}$`, 'i') }
      });

      if (settings) {
        foundSalonId = settings.salonId;
        foundSettings = settings;
        console.log(`✅ Salon trouvé avec recherche regex: ${foundSalonId}`);
        emailToSalonId.set(e, foundSalonId);
      }
    }

    if (!foundSalonId || !foundSettings) {
      console.log(`❌ Aucun compte trouvé pour: ${e}`);
      console.log(`📊 État du cache emailToSalonId:`, Array.from(emailToSalonId.entries()));
      return res.status(401).json({ error: "Aucun compte trouvé avec cet email" });
    }

    // Vérifications supplémentaires
    if (!foundSettings.adminEmail) {
      console.log(`❌ Aucun email admin configuré pour: ${foundSalonId}`);
      return res.status(400).json({ error: "Aucun email de récupération configuré" });
    }

    // Vérification case-insensitive de l'email
    const storedEmail = foundSettings.adminEmail.toLowerCase();
    const providedEmail = e.toLowerCase();

    if (storedEmail !== providedEmail) {
      console.log(`❌ Email non reconnu: ${providedEmail} vs ${storedEmail}`);
      return res.status(401).json({ error: "Email non reconnu" });
    }

    // Vérification du code de réinitialisation
    if (!foundSettings.resetCode || !foundSettings.resetExpiresAt) {
      console.log(`❌ Aucun code de réinitialisation pour: ${foundSalonId}`);
      return res.status(400).json({ error: "Code de réinitialisation non trouvé" });
    }

    if (Date.now() > foundSettings.resetExpiresAt) {
      console.log(`❌ Code expiré pour: ${foundSalonId}`);
      return res.status(400).json({ error: "Code expiré" });
    }

    if (foundSettings.resetCode !== c) {
      console.log(`❌ Code incorrect: ${c} vs ${foundSettings.resetCode}`);
      return res.status(401).json({ error: "Code de vérification incorrect" });
    }

    // Mise à jour du code admin
    console.log(`✅ Code admin valide, mise à jour pour: ${e}`);
    foundSettings.adminCodeHash = sha256(newCode);
    foundSettings.resetCode = null;
    foundSettings.resetExpiresAt = 0;
    foundSettings.adminToken = makeToken();

    await foundSettings.save();

    console.log(`✅ Code admin réinitialisé avec succès pour: ${e}`);

    return res.json({
      token: foundSettings.adminToken,
      salonId: foundSalonId,
      message: "Code admin réinitialisé avec succès"
    });

  } catch (error) {
    console.error('❌ Error in admin code recovery verify:', error);
    res.status(500).json({ error: "Erreur serveur lors de la réinitialisation du code admin" });
  }
};

export const updateConfig: RequestHandler = async (req, res) => {
  try {
    const body = await parseRequestBody(req);
    const salonId = getSalonId(req);
    const settings = await getSettings(salonId);
    const { loyaltyPercentDefault, paymentModes, commissionDefault, pointsRedeemDefault, salonName, showStylistPriority, hideTotalCA, currency } = body as {
      loyaltyPercentDefault?: number;
      paymentModes?: PaymentMethod[];
      commissionDefault?: number;
      pointsRedeemDefault?: number;
      salonName?: string | null;
      showStylistPriority?: boolean;
      hideTotalCA?: boolean;
      currency?: "EUR" | "USD" | "MAD" | "GBP";
    };

    const updates: any = {};

    if (typeof loyaltyPercentDefault === "number") updates.loyaltyPercentDefault = Math.max(0, Math.min(100, loyaltyPercentDefault));
    if (Array.isArray(paymentModes) && paymentModes.length) updates.paymentModes = paymentModes;
    if (typeof commissionDefault === "number") updates.commissionDefault = Math.max(0, Math.min(100, commissionDefault));
    if (typeof pointsRedeemDefault === "number" && Number.isFinite(pointsRedeemDefault)) {
      updates.pointsRedeemDefault = Math.max(0, Math.min(1_000_000, Math.round(pointsRedeemDefault)));
    }
    if (salonName !== undefined) {
      if (typeof salonName === "string") {
        const trimmed = salonName.trim();
        updates.salonName = trimmed.length > 0 ? trimmed : null;
      } else if (salonName === null) {
        updates.salonName = null;
      }
    }
    if (typeof showStylistPriority === "boolean") {
      updates.showStylistPriority = showStylistPriority;
    }
    if (typeof hideTotalCA === "boolean") {
      updates.hideTotalCA = hideTotalCA;
    }
    if (currency && ["EUR", "USD", "MAD", "GBP"].includes(currency)) {
      updates.currency = currency;
    }

    await Settings.findOneAndUpdate({ salonId }, { $set: updates });
    invalidateSettingsCache(salonId);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const addStylist: RequestHandler = async (req, res) => {
  try {
    const body = await parseRequestBody(req);
    const salonId = getSalonId(req);
    const settings = await getSettings(salonId);
    const { name, commissionPct } = body as { name?: string; commissionPct?: number };

    if (!name) return res.status(400).json({ error: "name is required" });

    const id = `s-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random().toString(36).slice(2, 6)}`;
    const stylist = new Stylist({
      id,
      name,
      commissionPct: typeof commissionPct === "number" ? commissionPct : settings.commissionDefault,
      salonId
    });

    await stylist.save();
    res.status(201).json({ stylist });
  } catch (error) {
    console.error('Error adding stylist:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

// === STYLIST DEPOSITS (ACOMPTES) ===

export const addStylistDeposit: RequestHandler = async (req, res) => {
  try {
    const body = await parseRequestBody(req);
    const salonId = getSalonId(req);
    const { stylistId, amount, month, note } = body as {
      stylistId?: string;
      amount?: number;
      month?: number;
      note?: string;
    };

    if (!stylistId) return res.status(400).json({ error: "stylistId is required" });
    if (typeof amount !== "number" || amount <= 0) return res.status(400).json({ error: "amount must be positive" });
    if (typeof month !== "number") return res.status(400).json({ error: "month is required (YYYYMM format)" });

    const stylist = await Stylist.findOne({ id: stylistId, salonId });
    if (!stylist) return res.status(404).json({ error: "Stylist not found" });

    const id = `dep-${stylistId.slice(0, 8)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const deposit = new StylistDeposit({
      id,
      stylistId,
      amount,
      month,
      note: note?.trim() || undefined,
      salonId
    });

    await deposit.save();
    res.status(201).json({ deposit });
  } catch (error) {
    console.error('Error adding stylist deposit:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const listStylistDeposits: RequestHandler = async (req, res) => {
  try {
    const salonId = getSalonId(req);
    const { stylistId, month } = req.query as { stylistId?: string; month?: string };

    const query: any = { salonId };
    if (stylistId) query.stylistId = stylistId;
    if (month) query.month = parseInt(month, 10);

    const deposits = await StylistDeposit.find(query).sort({ createdAt: -1 });
    res.json({ deposits });
  } catch (error) {
    console.error('Error listing stylist deposits:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const deleteStylistDeposit: RequestHandler = async (req, res) => {
  try {
    const salonId = getSalonId(req);
    const { depositId } = req.params;

    const result = await StylistDeposit.deleteOne({ id: depositId, salonId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Deposit not found" });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting stylist deposit:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

// === CLIENTS ===

export const listClients: RequestHandler = async (req, res) => {
  try {
    const salonId = getSalonId(req);
    const clients = await Client.find({ salonId });

    const lastVisits = new Map<string, number>();
    const prestations = await Prestation.find({ salonId });

    for (const prestation of prestations) {
      if (!prestation.clientId) continue;
      const current = lastVisits.get(prestation.clientId);
      if (current === undefined || prestation.timestamp > current) {
        lastVisits.set(prestation.clientId, prestation.timestamp);
      }
    }

    const clientsWithLastVisit = clients.map(client => ({
      ...client.toObject(),
      lastVisitAt: lastVisits.get(client.id) ?? null,
    }));

    res.json({ clients: clientsWithLastVisit });
  } catch (error) {
    console.error('Error listing clients:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const addClient: RequestHandler = async (req, res) => {
  try {
    const body = await parseRequestBody(req);
    const salonId = getSalonId(req);
    const { name, email, phone } = body as { name?: string; email?: string; phone?: string };

    if (!name) return res.status(400).json({ error: "name is required" });

    const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return res.status(400).json({ error: "invalid email" });
    }

    const rawPhone = typeof phone === "string" ? phone.trim() : "";
    const normalizedPhone = rawPhone ? rawPhone.replace(/[^+\d().\-\s]/g, "") : "";
    if (normalizedPhone && !/^[+\d(][\d().\-\s]{5,}$/.test(normalizedPhone)) {
      return res.status(400).json({ error: "invalid phone" });
    }

    const id = `c-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random().toString(36).slice(2, 6)}`;
    const client = new Client({
      id,
      name,
      points: 0,
      email: trimmedEmail || null,
      phone: normalizedPhone || null,
      lastVisitAt: null,
      salonId
    });

    await client.save();
    res.status(201).json({ client });
  } catch (error) {
    console.error('Error adding client:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const createPrestation: RequestHandler = async (req, res) => {
  try {
    const body = await parseRequestBody(req);
    const salonId = getSalonId(req);
    const { stylistId, clientId, amount, paymentMethod, timestamp, pointsPercent, serviceName, serviceId, mixedCardAmount, mixedCashAmount } = body as {
      stylistId?: string;
      clientId?: string;
      amount?: number;
      paymentMethod?: PaymentMethod;
      timestamp?: number;
      pointsPercent?: number;
      serviceName?: string;
      serviceId?: string;
      mixedCardAmount?: number;
      mixedCashAmount?: number;
    };

    if (!stylistId || typeof amount !== "number" || !paymentMethod) {
      return res.status(400).json({ error: "stylistId, amount and paymentMethod are required" });
    }

    // Paralléliser les requêtes initiales pour gagner du temps
    const [settings, stylist, existingClient] = await Promise.all([
      getSettings(salonId),
      Stylist.findOne({ id: stylistId, salonId }),
      clientId ? Client.findOne({ id: clientId, salonId }) : Promise.resolve(null)
    ]);

    if (!stylist) return res.status(404).json({ error: "stylist not found" });

    // Resolve clientId – if none provided or invalid, it remains undefined
    const finalClientId = existingClient ? clientId : undefined;

    const ts = typeof timestamp === "number" ? timestamp : Date.now();
    const pct = typeof pointsPercent === "number" ? pointsPercent : (settings.loyaltyPercentDefault ?? 5);
    const points = 1; // Fixed 1 point per prestation

    const prestation = new Prestation({
      id: `p-${Math.random().toString(36).slice(2)}`,
      stylistId,
      clientId: finalClientId,
      amount,
      paymentMethod,
      mixedCardAmount: paymentMethod === "mixed" ? mixedCardAmount : undefined,
      mixedCashAmount: paymentMethod === "mixed" ? mixedCashAmount : undefined,
      timestamp: ts,
      createdAt: Date.now(),
      pointsPercent: pct,
      pointsAwarded: points,
      serviceName,
      serviceId,
      salonId
    });

    // Sauvegarder la prestation et mettre à jour les points en parallèle
    const savePromises: Promise<any>[] = [prestation.save()];
    if (finalClientId) {
      savePromises.push(
        Client.findOneAndUpdate(
          { id: finalClientId, salonId },
          { $inc: { points } },
          { new: true }
        )
      );
    }
    const [savedPrestation, updatedClient] = await Promise.all(savePromises);

    // Retourner immédiatement sans attendre les stats (gain de temps significatif)
    const client = finalClientId ? updatedClient : undefined;

    res.status(201).json({ prestation: savedPrestation, client });
  } catch (error) {
    console.error('Error creating prestation:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const redeemPoints: RequestHandler = async (req, res) => {
  try {
    const body = await parseRequestBody(req);
    const salonId = getSalonId(req);
    const { clientId, points, reason, stylistId } = body as {
      clientId?: string;
      points?: number;
      reason?: string;
      stylistId?: string
    };

    if (!clientId || typeof points !== "number" || points <= 0) {
      return res.status(400).json({ error: "clientId and positive points required" });
    }

    // Paralléliser les vérifications initiales
    const [client, stylist] = await Promise.all([
      Client.findOne({ id: clientId, salonId }),
      stylistId ? Stylist.findOne({ id: stylistId, salonId }) : Promise.resolve(null)
    ]);

    if (!client) return res.status(404).json({ error: "client not found" });
    if (client.points < points) return res.status(400).json({ error: "insufficient points" });
    if (stylistId && !stylist) return res.status(404).json({ error: "stylist not found" });

    // Préparer les opérations à exécuter en parallèle
    const operations: Promise<any>[] = [
      Client.findOneAndUpdate(
        { id: clientId, salonId },
        { $inc: { points: -points } },
        { new: true }
      )
    ];

    let usage: IPointsRedemption | null = null;
    if (stylistId) {
      usage = new PointsRedemption({
        id: `redeem-${Math.random().toString(36).slice(2)}`,
        stylistId,
        clientId,
        points,
        timestamp: Date.now(),
        reason: (reason ?? "redeem").toString(),
        salonId
      });
      operations.push(usage.save());
    }

    const [updatedClient] = await Promise.all(operations);
    res.json({ client: updatedClient, reason: reason ?? "redeem", usage });
  } catch (error) {
    console.error('Error redeeming points:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const addPoints: RequestHandler = async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const body = await parseRequestBody(req);
    const salonId = getSalonId(req);
    const { clientId, points } = body as { clientId?: string; points?: number };

    if (!clientId || typeof points !== "number" || points <= 0) {
      return res.status(400).json({ error: "clientId and positive points required" });
    }

    const client = await Client.findOne({ id: clientId, salonId });
    if (!client) return res.status(404).json({ error: "client not found" });

    await Client.findOneAndUpdate(
      { id: clientId, salonId },
      { $inc: { points: points } }
    );

    const updatedClient = await Client.findOne({ id: clientId, salonId });
    res.json({ client: updatedClient });
  } catch (error) {
    console.error('Error adding points:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const updateTransactionPaymentMethod: RequestHandler = async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const body = await parseRequestBody(req);
    const salonId = getSalonId(req);
    const { id, kind, paymentMethod } = body as { id: string; kind: "prestation" | "produit"; paymentMethod: PaymentMethod };

    if (!id || !kind || !paymentMethod) {
      return res.status(400).json({ error: "id, kind and paymentMethod required" });
    }

    if (kind === "prestation") {
      const result = await Prestation.findOneAndUpdate({ id, salonId }, { $set: { paymentMethod } });
      if (!result) return res.status(404).json({ error: "prestation not found" });
    } else if (kind === "produit") {
      const result = await Product.findOneAndUpdate({ id, salonId }, { $set: { paymentMethod } });
      if (!result) return res.status(404).json({ error: "product not found" });
    } else {
      return res.status(400).json({ error: "invalid kind" });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error updating transaction payment method:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const pointsUsageReport: RequestHandler = async (req, res) => {
  try {
    const salonId = getSalonId(req);
    const query = req.query as { day?: string; month?: string };
    const now = Date.now();
    let dayRef = now;
    let monthRef = now;

    if (typeof query.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.day)) {
      const [y, m, d] = query.day.split("-").map(Number);
      if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d) && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        dayRef = Date.UTC(y, m - 1, d, 12, 0, 0);
      }
    }

    if (typeof query.month === "string" && /^\d{4}-\d{2}$/.test(query.month)) {
      const [y, m] = query.month.split("-").map(Number);
      if (!Number.isNaN(y) && !Number.isNaN(m) && m >= 1 && m <= 12) {
        monthRef = Date.UTC(y, m - 1, 1, 12, 0, 0);
      }
    } else if (!query.month && typeof query.day === "string") {
      monthRef = dayRef;
    }

    const report = await collectPointsUsage(salonId, { dayRef, monthRef, generatedAt: now });
    res.json(report);
  } catch (error) {
    console.error('Error generating points usage report:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const summaryReport: RequestHandler = async (req, res) => {
  try {
    const salonId = getSalonId(req);
    const all = await aggregateAllPayments(salonId);
    const now = Date.now();
    const todayStart = startOfDayParis(now);

    const products = await Product.find({ salonId });
    let dailyProductCount = 0;
    let monthlyProductCount = 0;

    for (const prod of products) {
      if (startOfDayParis(prod.timestamp) === todayStart) {
        dailyProductCount++;
      }
      if (isSameMonthParis(prod.timestamp, now)) {
        monthlyProductCount++;
      }
    }

    const prestations = await Prestation.find({ salonId }).sort({ timestamp: -1 }).limit(10);

    res.json({
      dailyAmount: all.daily.total.amount,
      dailyCount: all.daily.total.count,
      monthlyAmount: all.monthly.total.amount,
      monthlyCount: all.monthly.total.count,
      dailyProductCount,
      monthlyProductCount,
      dailyPayments: all.daily,
      monthlyPayments: all.monthly,
      lastPrestations: prestations,
    });
  } catch (error) {
    console.error('Error generating summary report:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const getGlobalBreakdown: RequestHandler = async (req, res) => {
  try {
    const salonId = getSalonId(req);
    const q = req.query as any;
    const dateStr = typeof q.date === "string" ? q.date : undefined;
    const startDateStr = typeof q.startDate === "string" ? q.startDate : undefined;
    const endDateStr = typeof q.endDate === "string" ? q.endDate : undefined;

    const now = Date.now();
    let ref = now;

    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split("-").map(Number);
      ref = Date.UTC(y, (m - 1), d, 12, 0, 0);
    }

    let startDateMs: number | undefined;
    let endDateMs: number | undefined;

    if (startDateStr && /^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) {
      const parsed = Date.parse(startDateStr + "T12:00:00");
      startDateMs = startOfDayParis(parsed);
    }
    if (endDateStr && /^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) {
      const parsed = Date.parse(endDateStr + "T12:00:00");
      endDateMs = startOfDayParis(parsed) + 24 * 60 * 60 * 1000 - 1;
    }

    const todayStart = startOfDayParis(ref);
    const [prestations, products, stylists, settings] = await Promise.all([
      Prestation.find({ salonId }),
      Product.find({ salonId }),
      Stylist.find({ salonId }),
      getSettings(salonId)
    ]);

    const stylistMap = new Map(stylists.map(s => [s.id, s]));

    const daily = makeScope();
    const monthly = makeScope();
    const range = makeScope();
    let dailySalaryTotal = 0;
    let monthlySalaryTotal = 0;
    let rangeSalaryTotal = 0;
    const dailyEntries: Array<{ id: string; timestamp: number; amount: number; paymentMethod: PaymentMethod; name?: string; kind: "prestation" | "produit"; mixedCardAmount?: number; mixedCashAmount?: number }> = [];
    const rangeEntries: Array<{ id: string; timestamp: number; amount: number; paymentMethod: PaymentMethod; name?: string; kind: "prestation" | "produit"; mixedCardAmount?: number; mixedCashAmount?: number }> = [];
    let dailyProductCount = 0;
    let monthlyProductCount = 0;
    let rangeProductCount = 0;
    let dailyPrestationCount = 0;
    let monthlyPrestationCount = 0;
    let rangePrestationCount = 0;

    let dailyTipCount = 0;
    let monthlyTipCount = 0;
    let rangeTipCount = 0;
    let dailyTipAmount = 0;
    let monthlyTipAmount = 0;
    let rangeTipAmount = 0;

    let dailyPrestationAmount = 0;
    let monthlyPrestationAmount = 0;
    let rangePrestationAmount = 0;
    let dailyProductAmount = 0;
    let monthlyProductAmount = 0;
    let rangeProductAmount = 0;

    for (const p of prestations) {
      const ts = startOfDayParis(p.timestamp);
      const isDaily = ts === todayStart;
      const isMonthly = isSameMonthParis(p.timestamp, ref);
      const isRange = startDateMs && endDateMs && p.timestamp >= startDateMs && p.timestamp <= endDateMs;
      const method = p.paymentMethod as PaymentMethod;
      const isTip = p.serviceName === "Pourboire";
      const isCashTip = isTip && method === "cash";

      const stylist = stylistMap.get(p.stylistId);
      const pct = typeof stylist?.commissionPct === "number" ? stylist.commissionPct : settings.commissionDefault;
      const salary = isTip ? 0 : (p.amount * pct) / 100;

      if (isDaily) {
        if (!isTip) {
          daily.total.amount += p.amount;
          daily.total.count += 1;
          if (method === "mixed" && (p as any).mixedCardAmount && (p as any).mixedCashAmount) {
            daily.methods.card.amount += (p as any).mixedCardAmount;
            daily.methods.cash.amount += (p as any).mixedCashAmount;
            daily.methods.mixed.count += 1;
          } else if (daily.methods[method]) {
            daily.methods[method].amount += p.amount;
            daily.methods[method].count += 1;
          }
          dailyPrestationCount++;
          dailyPrestationAmount += p.amount;
          dailySalaryTotal += salary;
        } else {
          dailyTipCount++;
          dailyTipAmount += p.amount;
        }
        dailyEntries.push({
          id: p.id,
          timestamp: p.timestamp,
          amount: p.amount,
          paymentMethod: p.paymentMethod,
          name: (p as any).serviceName || "prestation",
          kind: "prestation",
          mixedCardAmount: (p as any).mixedCardAmount,
          mixedCashAmount: (p as any).mixedCashAmount
        });
      }
      if (isMonthly) {
        if (!isTip) {
          monthly.total.amount += p.amount;
          monthly.total.count += 1;
          if (method === "mixed" && (p as any).mixedCardAmount && (p as any).mixedCashAmount) {
            monthly.methods.card.amount += (p as any).mixedCardAmount;
            monthly.methods.cash.amount += (p as any).mixedCashAmount;
            monthly.methods.mixed.count += 1;
          } else if (monthly.methods[method]) {
            monthly.methods[method].amount += p.amount;
            monthly.methods[method].count += 1;
          }
          monthlyPrestationCount++;
          monthlyPrestationAmount += p.amount;
          monthlySalaryTotal += salary;
        } else {
          monthlyTipCount++;
          monthlyTipAmount += p.amount;
        }
      }
      if (isRange) {
        if (!isTip) {
          range.total.amount += p.amount;
          range.total.count += 1;
          if (method === "mixed" && (p as any).mixedCardAmount && (p as any).mixedCashAmount) {
            range.methods.card.amount += (p as any).mixedCardAmount;
            range.methods.cash.amount += (p as any).mixedCashAmount;
            range.methods.mixed.count += 1;
          } else if (range.methods[method]) {
            range.methods[method].amount += p.amount;
            range.methods[method].count += 1;
          }
          rangePrestationCount++;
          rangePrestationAmount += p.amount;
          rangeSalaryTotal += salary;
        } else {
          rangeTipCount++;
          rangeTipAmount += p.amount;
        }
        rangeEntries.push({
          id: p.id,
          timestamp: p.timestamp,
          amount: p.amount,
          paymentMethod: p.paymentMethod,
          name: (p as any).serviceName || "prestation",
          kind: "prestation",
          mixedCardAmount: (p as any).mixedCardAmount,
          mixedCashAmount: (p as any).mixedCashAmount
        });
      }
    }

    for (const prod of products) {
      const ts = startOfDayParis(prod.timestamp);
      const isDaily = ts === todayStart;
      const isMonthly = isSameMonthParis(prod.timestamp, ref);
      const isRange = startDateMs && endDateMs && prod.timestamp >= startDateMs && prod.timestamp <= endDateMs;
      const prodMethod = prod.paymentMethod as PaymentMethod;

      if (isDaily) {
        daily.total.amount += prod.amount;
        if (prodMethod === "mixed" && (prod as any).mixedCardAmount && (prod as any).mixedCashAmount) {
          daily.methods.card.amount += (prod as any).mixedCardAmount;
          daily.methods.cash.amount += (prod as any).mixedCashAmount;
        } else if (daily.methods[prodMethod]) {
          daily.methods[prodMethod].amount += prod.amount;
        }
        dailyProductCount++;
        dailyProductAmount += prod.amount;
        dailyEntries.push({
          id: prod.id,
          timestamp: prod.timestamp,
          amount: prod.amount,
          paymentMethod: prod.paymentMethod,
          name: "produit",
          kind: "produit",
          mixedCardAmount: (prod as any).mixedCardAmount,
          mixedCashAmount: (prod as any).mixedCashAmount
        });
      }
      if (isMonthly) {
        monthly.total.amount += prod.amount;
        if (prodMethod === "mixed" && (prod as any).mixedCardAmount && (prod as any).mixedCashAmount) {
          monthly.methods.card.amount += (prod as any).mixedCardAmount;
          monthly.methods.cash.amount += (prod as any).mixedCashAmount;
        } else if (monthly.methods[prodMethod]) {
          monthly.methods[prodMethod].amount += prod.amount;
        }
        monthlyProductCount++;
        monthlyProductAmount += prod.amount;
      }
      if (isRange) {
        range.total.amount += prod.amount;
        if (prodMethod === "mixed" && (prod as any).mixedCardAmount && (prod as any).mixedCashAmount) {
          range.methods.card.amount += (prod as any).mixedCardAmount;
          range.methods.cash.amount += (prod as any).mixedCashAmount;
        } else if (range.methods[prodMethod]) {
          range.methods[prodMethod].amount += prod.amount;
        }
        rangeProductCount++;
        rangeProductAmount += prod.amount;
        rangeEntries.push({
          id: prod.id,
          timestamp: prod.timestamp,
          amount: prod.amount,
          paymentMethod: prod.paymentMethod,
          name: "produit",
          kind: "produit",
          mixedCardAmount: (prod as any).mixedCardAmount,
          mixedCashAmount: (prod as any).mixedCashAmount
        });
      }
    }

    dailyEntries.sort((a, b) => b.timestamp - a.timestamp);
    rangeEntries.sort((a, b) => b.timestamp - a.timestamp);

    res.json({
      daily,
      monthly,
      range: startDateMs && endDateMs ? range : undefined,
      dailyEntries,
      rangeEntries: startDateMs && endDateMs ? rangeEntries : [],
      dailyProductCount,
      monthlyProductCount,
      rangeProductCount: startDateMs && endDateMs ? rangeProductCount : 0,
      dailyPrestationCount,
      monthlyPrestationCount,
      rangePrestationCount: startDateMs && endDateMs ? rangePrestationCount : 0,
      dailyTipCount,
      monthlyTipCount,
      rangeTipCount: startDateMs && endDateMs ? rangeTipCount : 0,
      dailyTipAmount,
      monthlyTipAmount,
      rangeTipAmount: startDateMs && endDateMs ? rangeTipAmount : 0,
      dailySalaryTotal,
      monthlySalaryTotal,
      rangeSalaryTotal: startDateMs && endDateMs ? rangeSalaryTotal : 0,
      dailyPrestationAmount,
      monthlyPrestationAmount,
      rangePrestationAmount: startDateMs && endDateMs ? rangePrestationAmount : 0,
      dailyProductAmount,
      monthlyProductAmount,
      rangeProductAmount: startDateMs && endDateMs ? rangeProductAmount : 0,
    });
  } catch (error) {
    console.error('Error getting global breakdown:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const getStylistBreakdown: RequestHandler = async (req, res) => {
  try {
    const salonId = getSalonId(req);
    const { id } = req.params as { id: string };

    const stylist = await Stylist.findOne({ id, salonId });
    if (!stylist) return res.status(404).json({ error: "stylist not found" });

    const q = req.query as any;
    const dateStr = typeof q.date === "string" ? q.date : undefined;
    const startDateStr = typeof q.startDate === "string" ? q.startDate : undefined;
    const endDateStr = typeof q.endDate === "string" ? q.endDate : undefined;
    let ref = Date.now();

    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split("-").map(Number);
      ref = Date.UTC(y, (m - 1), d, 12, 0, 0);
    }

    let startDateMs: number | undefined;
    let endDateMs: number | undefined;

    if (startDateStr && /^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) {
      const parsed = Date.parse(startDateStr + "T12:00:00");
      startDateMs = startOfDayParis(parsed);
    }
    if (endDateStr && /^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) {
      const parsed = Date.parse(endDateStr + "T12:00:00");
      endDateMs = startOfDayParis(parsed) + 24 * 60 * 60 * 1000 - 1;
    }

    const hiddenPeriods = (stylist as any).hiddenPeriods || [];
    const data = await aggregateByPayment(salonId, id, ref, startDateMs, endDateMs, hiddenPeriods);
    res.json(data);
  } catch (error) {
    console.error('Error getting stylist breakdown:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const setStylistCommission: RequestHandler = async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const body = await parseRequestBody(req);
    const salonId = getSalonId(req);
    const { id } = req.params as { id: string };
    const { commissionPct } = body as { commissionPct?: number };

    const stylist = await Stylist.findOne({ id, salonId });
    if (!stylist) return res.status(404).json({ error: "stylist not found" });
    if (typeof commissionPct !== "number") return res.status(400).json({ error: "commissionPct required" });

    stylist.commissionPct = clampCommission(commissionPct);
    await stylist.save();

    res.json({ stylist });
  } catch (error) {
    console.error('Error setting stylist commission:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const updateStylist: RequestHandler = async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const body = await parseRequestBody(req);
    const salonId = getSalonId(req);
    const { id } = req.params as { id: string };
    const { name, commissionPct, hiddenMonths, hiddenPeriods } = body as {
      name?: string;
      commissionPct?: number;
      hiddenMonths?: number[];
      hiddenPeriods?: { month: number; startDay: number; endDay: number }[];
    };

    const stylist = await Stylist.findOne({ id, salonId });
    if (!stylist) return res.status(404).json({ error: "stylist not found" });
    if (name === undefined && commissionPct === undefined && hiddenMonths === undefined && hiddenPeriods === undefined) {
      return res.status(400).json({ error: "no updates provided" });
    }

    const updates: any = {};
    if (typeof name === "string") {
      const trimmed = name.trim();
      if (!trimmed) return res.status(400).json({ error: "name is required" });
      updates.name = trimmed;
    }
    if (typeof commissionPct === "number") {
      updates.commissionPct = clampCommission(commissionPct);
    }
    if (Array.isArray(hiddenMonths)) {
      updates.hiddenMonths = hiddenMonths.filter(m => typeof m === "number");
    }
    if (Array.isArray(hiddenPeriods)) {
      updates.hiddenPeriods = hiddenPeriods.filter(p =>
        typeof p === "object" && p !== null &&
        typeof p.month === "number" &&
        typeof p.startDay === "number" && p.startDay >= 1 && p.startDay <= 31 &&
        typeof p.endDay === "number" && p.endDay >= 1 && p.endDay <= 31
      );
    }

    await Stylist.findOneAndUpdate({ id, salonId }, { $set: updates });
    const updatedStylist = await Stylist.findOne({ id, salonId });

    res.json({ stylist: updatedStylist });
  } catch (error) {
    console.error('Error updating stylist:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const deleteStylist: RequestHandler = async (req, res) => {
  try {
    const salonId = getSalonId(req);
    const { id } = req.params as { id: string };

    const result = await Stylist.deleteOne({ id, salonId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "stylist not found" });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting stylist:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const setStylistSecretCode: RequestHandler = async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const body = await parseRequestBody(req);
    const salonId = getSalonId(req);
    const { id } = req.params as { id: string };
    const { secretCode } = body as { secretCode?: string };

    const stylist = await Stylist.findOne({ id, salonId });
    if (!stylist) return res.status(404).json({ error: "stylist not found" });

    stylist.secretCode = secretCode?.trim() || null;
    await stylist.save();

    res.json({ ok: true, hasCode: Boolean(stylist.secretCode) });
  } catch (error) {
    console.error('Error setting stylist secret code:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const verifyStylistSecretCode: RequestHandler = async (req, res) => {
  try {
    const body = await parseRequestBody(req);
    const salonId = getSalonId(req);
    const { id } = req.params as { id: string };
    const { code } = body as { code?: string };

    const stylist = await Stylist.findOne({ id, salonId });
    if (!stylist) return res.status(404).json({ error: "stylist not found" });

    if (!stylist.secretCode) {
      return res.json({ valid: true, noCodeRequired: true });
    }

    const valid = code === stylist.secretCode;
    res.json({ valid });
  } catch (error) {
    console.error('Error verifying stylist secret code:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const getStylistHasSecretCode: RequestHandler = async (req, res) => {
  try {
    const salonId = getSalonId(req);
    const { id } = req.params as { id: string };

    const stylist = await Stylist.findOne({ id, salonId });
    if (!stylist) return res.status(404).json({ error: "stylist not found" });

    res.json({ hasCode: Boolean(stylist.secretCode) });
  } catch (error) {
    console.error('Error checking stylist secret code:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const deleteClient: RequestHandler = async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const salonId = getSalonId(req);
    const { id } = req.params as { id: string };

    const result = await Client.deleteOne({ id, salonId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "client not found" });
    }

    await Prestation.updateMany(
      { clientId: id, salonId },
      { $unset: { clientId: "" } }
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const deletePrestation: RequestHandler = async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const salonId = getSalonId(req);
    const { id } = req.params as { id: string };

    // Try to find and delete a prestation first
    const prestation = await Prestation.findOne({ id, salonId });
    if (prestation) {
      // Remove loyalty points if applicable
      if (prestation.clientId && prestation.pointsAwarded > 0) {
        await Client.updateOne(
          { id: prestation.clientId, salonId },
          { $inc: { loyaltyPoints: -prestation.pointsAwarded } }
        );
      }

      // Delete the prestation
      await Prestation.deleteOne({ id, salonId });
      return res.json({ ok: true });
    }

    // If not found as prestation, try to find and delete as product
    const product = await Product.findOne({ id, salonId });
    if (product) {
      await Product.deleteOne({ id, salonId });
      return res.json({ ok: true });
    }

    return res.status(404).json({ error: "prestation or product not found" });
  } catch (error) {
    console.error('Error deleting prestation/product:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const listServices: RequestHandler = async (req, res) => {
  try {
    const salonId = getSalonId(req);
    const services = await Service.find({ salonId }).sort({ sortOrder: 1, createdAt: 1 });
    res.json({ services });
  } catch (error) {
    console.error('Error listing services:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const addService: RequestHandler = async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const body = await parseRequestBody(req);
    const salonId = getSalonId(req);
    const { name, price, description } = body as { name: string; price: number; description?: string };

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "service name is required" });
    }
    if (typeof price !== "number" || price < 0) {
      return res.status(400).json({ error: "service price must be a positive number" });
    }

    const id = `service_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    // Get the max sortOrder to add new service at the end
    const maxOrderService = await Service.findOne({ salonId }).sort({ sortOrder: -1 });
    const nextSortOrder = (maxOrderService?.sortOrder ?? -1) + 1;

    const service = new Service({
      id,
      name: name.trim(),
      price,
      description: description ? String(description).trim() : undefined,
      sortOrder: nextSortOrder,
      salonId
    });

    await service.save();
    res.status(201).json({ service });
  } catch (error) {
    console.error('Error adding service:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const deleteService: RequestHandler = async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const salonId = getSalonId(req);
    const { id } = req.params as { id: string };

    const result = await Service.deleteOne({ id, salonId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "service not found" });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const reorderServices: RequestHandler = async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const body = await parseRequestBody(req);
    const salonId = getSalonId(req);
    const { orderedIds } = body as { orderedIds: string[] };

    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: "orderedIds must be an array" });
    }

    // Update sortOrder for each service
    const bulkOps = orderedIds.map((id, index) => ({
      updateOne: {
        filter: { id, salonId },
        update: { $set: { sortOrder: index } }
      }
    }));

    if (bulkOps.length > 0) {
      await Service.bulkWrite(bulkOps);
    }

    // Return updated services
    const services = await Service.find({ salonId }).sort({ sortOrder: 1, createdAt: 1 });
    res.json({ services });
  } catch (error) {
    console.error('Error reordering services:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const listProductTypes: RequestHandler = async (req, res) => {
  try {
    const salonId = getSalonId(req);
    const productTypes = await ProductType.find({ salonId }).sort({ sortOrder: 1, createdAt: 1 });
    res.json({ productTypes });
  } catch (error) {
    console.error('Error listing product types:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const addProductType: RequestHandler = async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const body = await parseRequestBody(req);
    const salonId = getSalonId(req);
    const { name, price, description } = body as { name: string; price: number; description?: string };

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "product type name is required" });
    }
    if (typeof price !== "number" || price < 0) {
      return res.status(400).json({ error: "product type price must be a positive number" });
    }

    const id = `product-type_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const productType = new ProductType({
      id,
      name: name.trim(),
      price,
      description: description ? String(description).trim() : undefined,
      salonId
    });

    await productType.save();
    res.status(201).json({ productType });
  } catch (error) {
    console.error('Error adding product type:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const deleteProductType: RequestHandler = async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const salonId = getSalonId(req);
    const { id } = req.params as { id: string };

    const result = await ProductType.deleteOne({ id, salonId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "product type not found" });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting product type:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const reorderProductTypes: RequestHandler = async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const body = await parseRequestBody(req);
    const salonId = getSalonId(req);
    const { orderedIds } = body as { orderedIds: string[] };

    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: "orderedIds must be an array" });
    }

    const bulkOps = orderedIds.map((id, index) => ({
      updateOne: {
        filter: { id, salonId },
        update: { $set: { sortOrder: index } }
      }
    }));

    if (bulkOps.length > 0) {
      await ProductType.bulkWrite(bulkOps);
    }

    const productTypes = await ProductType.find({ salonId }).sort({ sortOrder: 1, createdAt: 1 });
    res.json({ productTypes });
  } catch (error) {
    console.error('Error reordering product types:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const createProduct: RequestHandler = async (req, res) => {
  try {
    const body = await parseRequestBody(req);
    const salonId = getSalonId(req);
    const { stylistId, clientId, amount, paymentMethod, timestamp, productName, productTypeId, mixedCardAmount, mixedCashAmount } = body as {
      stylistId?: string;
      clientId?: string;
      amount?: number;
      paymentMethod?: PaymentMethod;
      timestamp?: number;
      productName?: string;
      productTypeId?: string;
      mixedCardAmount?: number;
      mixedCashAmount?: number;
    };

    if (!stylistId || typeof amount !== "number" || !paymentMethod) {
      return res.status(400).json({ error: "stylistId, amount and paymentMethod are required" });
    }

    const stylist = await Stylist.findOne({ id: stylistId, salonId });
    if (!stylist) return res.status(404).json({ error: "stylist not found" });

    // For products, clientId is optional – use it if provided, otherwise leave undefined
    const finalClientId = clientId;

    const ts = typeof timestamp === "number" ? timestamp : Date.now();

    const product = new Product({
      id: `prod-${Math.random().toString(36).slice(2)}`,
      stylistId,
      clientId: finalClientId,
      amount,
      paymentMethod,
      mixedCardAmount: paymentMethod === "mixed" ? mixedCardAmount : undefined,
      mixedCashAmount: paymentMethod === "mixed" ? mixedCashAmount : undefined,
      timestamp: ts,
      productName,
      productTypeId,
      salonId
    });

    await product.save();

    const stylistStats = await aggregateForStylist(stylistId, salonId);
    const client = finalClientId ? await Client.findOne({ id: finalClientId, salonId }) : undefined;

    res.status(201).json({ product, stylistStats, client });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const listProducts: RequestHandler = async (req, res) => {
  try {
    const salonId = getSalonId(req);
    const products = await Product.find({ salonId }).sort({ timestamp: -1 });
    res.json({ products });
  } catch (error) {
    console.error('Error listing products:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

// Fonctions d'export CSV/PDF
export const exportSummaryCSV: RequestHandler = async (req, res) => {
  try {
    const salonId = getSalonId(req);
    const all = await aggregateAllPayments(salonId);
    const rows: string[] = [];
    rows.push(["periode", "mode", "nombre", "montant_eur"].join(","));
    const emit = (period: string, method: PaymentMethod, r: { amount: number; count: number }) => {
      rows.push([period, method, String(r.count), r.amount.toFixed(2)].join(","));
    };
    (Object.keys(all.daily.methods) as PaymentMethod[]).forEach((m) => emit("jour", m, all.daily.methods[m]));
    rows.push(["jour", "total", String(all.daily.total.count), all.daily.total.amount.toFixed(2)].join(","));
    (Object.keys(all.monthly.methods) as PaymentMethod[]).forEach((m) => emit("mois", m, all.monthly.methods[m]));
    rows.push(["mois", "total", String(all.monthly.total.count), all.monthly.total.amount.toFixed(2)].join(","));
    const csv = rows.join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=rapport-ca.csv");
    res.send(csv);
  } catch (error) {
    console.error('Error exporting summary CSV:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const exportSummaryPDF: RequestHandler = async (req, res) => {
  try {
    const salonId = getSalonId(req);
    const all = await aggregateAllPayments(salonId);
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    let y = 800;
    page.drawText(sanitizePdfText("Rapport CA - Modes de paiement"), { x: 40, y, size: 18, font, color: rgb(0.2, 0.2, 0.2) });
    y -= 30;
    const drawSection = (label: string, scope: ReturnType<typeof makeScope>) => {
      page.drawText(sanitizePdfText(label), { x: 40, y, size: 14, font });
      y -= 20;
      const headers = ["Mode", "Nombre", "Montant (EUR)"];
      const methods: [string, { amount: number; count: number }][] = [
        ["Especes", scope.methods.cash],
        ["Cheque", scope.methods.check],
        ["Carte", scope.methods.card],
      ];
      const rows = methods.concat([["Total", scope.total] as any]);
      const startX = 40; const colW = [200, 120, 160];
      const drawRow = (vals: string[], bold = false) => {
        vals.forEach((v, i) => page.drawText(sanitizePdfText(v), { x: startX + colW.slice(0, i).reduce((a, b) => a + b, 0), y, size: 11, font, color: rgb(0, 0, 0) }));
        y -= 16;
      };
      drawRow(headers, true);
      rows.forEach(([name, r]) => drawRow([name, String(r.count), r.amount.toFixed(2)]));
      y -= 12;
    };
    drawSection("Aujourd'hui", all.daily);
    drawSection("Ce mois-ci", all.monthly);
    const bytes = await pdf.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=rapport-ca.pdf");
    res.send(Buffer.from(bytes));
  } catch (error) {
    console.error('Error exporting summary PDF:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const exportStylistCSV: RequestHandler = async (req, res) => {
  try {
    const salonId = getSalonId(req);
    const { id } = req.params as { id: string };
    const s = await Stylist.findOne({ id, salonId });
    if (!s) return res.status(404).json({ error: "stylist not found" });
    const data = await aggregateByPayment(salonId, id);
    const rows: string[] = [];
    rows.push(["coiffeur", "periode", "mode", "nombre", "montant_eur"].join(","));
    const emit = (period: string, method: PaymentMethod, r: { amount: number; count: number }) => {
      rows.push([s.name, period, method, String(r.count), r.amount.toFixed(2)].join(","));
    };
    (Object.keys(data.daily.methods) as PaymentMethod[]).forEach((m) => emit("jour", m, data.daily.methods[m]));
    rows.push([s.name, "jour", "total", String(data.daily.total.count), data.daily.total.amount.toFixed(2)].join(","));
    (Object.keys(data.monthly.methods) as PaymentMethod[]).forEach((m) => emit("mois", m, data.monthly.methods[m]));
    rows.push([s.name, "mois", "total", String(data.monthly.total.count), data.monthly.total.amount.toFixed(2)].join(","));
    const csv = rows.join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=rapport-coiffeur-${s.name.replace(/[^a-z0-9-]+/gi, '_')}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting stylist CSV:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const exportStylistPDF: RequestHandler = async (req, res) => {
  try {
    const salonId = getSalonId(req);
    const { id } = req.params as { id: string };
    const s = await Stylist.findOne({ id, salonId });
    if (!s) return res.status(404).json({ error: "stylist not found" });
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const data = await aggregateByPayment(salonId, id);
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    let y = 800;
    page.drawText(sanitizePdfText(`Rapport CA Coiffeur - ${s.name}`), { x: 40, y, size: 18, font, color: rgb(0.2, 0.2, 0.2) });
    y -= 30;
    const drawSection = (label: string, scope: ReturnType<typeof makeScope>) => {
      page.drawText(sanitizePdfText(label), { x: 40, y, size: 14, font });
      y -= 20;
      const headers = ["Mode", "Nombre", "Montant (EUR)"];
      const methods: [string, { amount: number; count: number }][] = [
        ["Especes", scope.methods.cash],
        ["Cheque", scope.methods.check],
        ["Carte", scope.methods.card],
      ];
      const rows = methods.concat([["Total", scope.total] as any]);
      const startX = 40; const colW = [200, 120, 160];
      const drawRow = (vals: string[]) => {
        vals.forEach((v, i) => page.drawText(sanitizePdfText(v), { x: startX + colW.slice(0, i).reduce((a, b) => a + b, 0), y, size: 11, font, color: rgb(0, 0, 0) }));
        y -= 16;
      };
      page.drawText(sanitizePdfText(headers[0]), { x: startX, y, size: 11, font, color: rgb(0, 0, 0) });
      page.drawText(sanitizePdfText(headers[1]), { x: startX + colW[0], y, size: 11, font, color: rgb(0, 0, 0) });
      page.drawText(sanitizePdfText(headers[2]), { x: startX + colW[0] + colW[1], y, size: 11, font, color: rgb(0, 0, 0) });
      y -= 16;
      rows.forEach(([name, r]) => drawRow([name, String(r.count), r.amount.toFixed(2)]));
      y -= 12;
    };
    drawSection("Aujourd'hui", data.daily);
    drawSection("Ce mois-ci", data.monthly);
    const bytes = await pdf.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=rapport-coiffeur-${s.name.replace(/[^a-z0-9-]+/gi, '_')}.pdf`);
    res.send(Buffer.from(bytes));
  } catch (error) {
    console.error('Error exporting stylist PDF:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const reportByDay: RequestHandler = async (req, res) => {
  try {
    const salonId = getSalonId(req);
    const settings = await getSettings(salonId);
    const now = new Date();
    const q = req.query as any;
    const qYear = Number(q.year);
    const qMonth = Number(q.month);
    const year = Number.isFinite(qYear) ? qYear : now.getFullYear();
    const monthIdx = Number.isFinite(qMonth) && qMonth >= 1 && qMonth <= 12 ? qMonth - 1 : now.getMonth();

    const startDate = new Date(year, monthIdx, 1);
    const endDate = new Date(year, monthIdx + 1, 0);
    const end = (Number.isFinite(qYear) && Number.isFinite(qMonth)) ? endDate.getTime() : now.getTime();

    const dayMs = 24 * 60 * 60 * 1000;
    const days: { date: string; amount: number; count: number; salary: number; productCount: number; methods: Record<PaymentMethod, { amount: number; count: number }> }[] = [];
    const totals = new Map<number, { amount: number; count: number }>();
    const salaryTotals = new Map<number, number>();
    const dailyMethodTotals = new Map<number, Record<PaymentMethod, { amount: number; count: number }>>();
    const dailyProductCounts = new Map<number, number>();
    const monthlyTotals = makeScope();
    let monthlySalary = 0;

    const [prestations, products, stylists] = await Promise.all([
      Prestation.find({ salonId }),
      Product.find({ salonId }),
      Stylist.find({ salonId })
    ]);

    const stylistMap = new Map(stylists.map(s => [s.id, s]));

    for (const p of prestations) {
      const d = new Date(p.timestamp);
      if (d.getFullYear() !== year || d.getMonth() !== monthIdx) continue;
      const dStart = startOfDayParis(p.timestamp);
      const isTip = p.serviceName === "Pourboire";
      const isCashTip = isTip && p.paymentMethod === "cash";

      const cur = totals.get(dStart) || { amount: 0, count: 0 };
      if (!isCashTip) {
        cur.amount += p.amount;
      }
      cur.count += 1;
      totals.set(dStart, cur);

      const stylist = stylistMap.get(p.stylistId);
      const pct = typeof stylist?.commissionPct === "number" ? stylist.commissionPct : settings.commissionDefault;
      const salary = isTip ? 0 : (p.amount * pct) / 100;
      monthlySalary += salary;
      salaryTotals.set(dStart, (salaryTotals.get(dStart) || 0) + salary);

      let scope = dailyMethodTotals.get(dStart);
      if (!scope) {
        scope = {
          cash: { amount: 0, count: 0 },
          check: { amount: 0, count: 0 },
          card: { amount: 0, count: 0 },
          mixed: { amount: 0, count: 0 },
        };
        dailyMethodTotals.set(dStart, scope);
      }
      if (p.paymentMethod === "mixed" && (p as any).mixedCardAmount && (p as any).mixedCashAmount) {
        scope.card.amount += (p as any).mixedCardAmount;
        scope.cash.amount += (p as any).mixedCashAmount;
        scope.mixed.count += 1;
        monthlyTotals.methods.card.amount += (p as any).mixedCardAmount;
        monthlyTotals.methods.cash.amount += (p as any).mixedCashAmount;
        monthlyTotals.methods.mixed.count += 1;
      } else {
        if (!isCashTip) {
          scope[p.paymentMethod].amount += p.amount;
          monthlyTotals.methods[p.paymentMethod].amount += p.amount;
        }
        scope[p.paymentMethod].count += 1;
        monthlyTotals.methods[p.paymentMethod].count += 1;
      }

      if (!isCashTip) {
        monthlyTotals.total.amount += p.amount;
      }
      monthlyTotals.total.count += 1;
    }

    for (const prod of products) {
      const d = new Date(prod.timestamp);
      if (d.getFullYear() !== year || d.getMonth() !== monthIdx) continue;
      const dStart = startOfDayParis(prod.timestamp);
      const cur = totals.get(dStart) || { amount: 0, count: 0 };
      cur.amount += prod.amount;
      totals.set(dStart, cur);

      let scope = dailyMethodTotals.get(dStart);
      if (!scope) {
        scope = {
          cash: { amount: 0, count: 0 },
          check: { amount: 0, count: 0 },
          card: { amount: 0, count: 0 },
          mixed: { amount: 0, count: 0 },
        };
        dailyMethodTotals.set(dStart, scope);
      }
      if (prod.paymentMethod === "mixed" && (prod as any).mixedCardAmount && (prod as any).mixedCashAmount) {
        scope.card.amount += (prod as any).mixedCardAmount;
        scope.cash.amount += (prod as any).mixedCashAmount;
        monthlyTotals.methods.card.amount += (prod as any).mixedCardAmount;
        monthlyTotals.methods.cash.amount += (prod as any).mixedCashAmount;
      } else {
        scope[prod.paymentMethod].amount += prod.amount;
        monthlyTotals.methods[prod.paymentMethod].amount += prod.amount;
      }

      dailyProductCounts.set(dStart, (dailyProductCounts.get(dStart) || 0) + 1);

      monthlyTotals.total.amount += prod.amount;
    }

    for (let t = startDate.getTime(); t <= end; t += dayMs) {
      const key = startOfDayParis(t);
      const v = totals.get(key) || { amount: 0, count: 0 };
      const iso = formatParisISODate(key);
      const methodTotals = dailyMethodTotals.get(key);
      const methods: Record<PaymentMethod, { amount: number; count: number }> = {
        cash: { amount: methodTotals?.cash.amount ?? 0, count: methodTotals?.cash.count ?? 0 },
        check: { amount: methodTotals?.check.amount ?? 0, count: methodTotals?.check.count ?? 0 },
        card: { amount: methodTotals?.card.amount ?? 0, count: methodTotals?.card.count ?? 0 },
        mixed: { amount: methodTotals?.mixed.amount ?? 0, count: methodTotals?.mixed.count ?? 0 },
      };
      days.push({ date: iso, amount: v.amount, count: v.count, salary: salaryTotals.get(key) || 0, productCount: dailyProductCounts.get(key) || 0, methods });
    }
    res.json({ days, total: monthlyTotals.total, methods: monthlyTotals.methods, salaryTotal: monthlySalary });
  } catch (error) {
    console.error('Error generating report by day:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const reportByMonth: RequestHandler = async (req, res) => {
  try {
    const salonId = getSalonId(req);
    const settings = await getSettings(salonId);
    const now = new Date();
    const qYear = Number((req.query as any).year);
    const year = Number.isFinite(qYear) ? qYear : now.getFullYear();
    const monthlyScopes = new Map<number, ReturnType<typeof makeScope>>();
    const monthlySalaryTotals = new Map<number, number>();
    const monthlyProductCounts = new Map<number, number>();
    const yearlyScope = makeScope();
    let yearlySalaryTotal = 0;
    let yearlyProductCount = 0;

    const [prestations, products, stylists] = await Promise.all([
      Prestation.find({ salonId }),
      Product.find({ salonId }),
      Stylist.find({ salonId })
    ]);

    const stylistMap = new Map(stylists.map(s => [s.id, s]));

    for (const p of prestations) {
      const d = new Date(p.timestamp);
      if (d.getFullYear() !== year) continue;
      const key = d.getMonth();
      let scope = monthlyScopes.get(key);
      if (!scope) {
        scope = makeScope();
        monthlyScopes.set(key, scope);
      }
      const method = p.paymentMethod as PaymentMethod;
      const isTip = p.serviceName === "Pourboire";

      if (!isTip) {
        scope.total.amount += p.amount;
        scope.total.count += 1;
        if (method === "mixed" && (p as any).mixedCardAmount && (p as any).mixedCashAmount) {
          scope.methods.card.amount += (p as any).mixedCardAmount;
          scope.methods.cash.amount += (p as any).mixedCashAmount;
          scope.methods.mixed.count += 1;
          yearlyScope.methods.card.amount += (p as any).mixedCardAmount;
          yearlyScope.methods.cash.amount += (p as any).mixedCashAmount;
          yearlyScope.methods.mixed.count += 1;
        } else if (scope.methods[method]) {
          scope.methods[method].amount += p.amount;
          scope.methods[method].count += 1;
          if (yearlyScope.methods[method]) {
            yearlyScope.methods[method].amount += p.amount;
            yearlyScope.methods[method].count += 1;
          }
        }
        yearlyScope.total.amount += p.amount;
        yearlyScope.total.count += 1;
      }
      const stylist = stylistMap.get(p.stylistId);
      const pct = typeof stylist?.commissionPct === "number" ? stylist.commissionPct : settings.commissionDefault;
      const salary = isTip ? 0 : (p.amount * pct) / 100;
      yearlySalaryTotal += salary;
      monthlySalaryTotals.set(key, (monthlySalaryTotals.get(key) || 0) + salary);
    }

    for (const prod of products) {
      const d = new Date(prod.timestamp);
      if (d.getFullYear() !== year) continue;
      const key = d.getMonth();
      let scope = monthlyScopes.get(key);
      if (!scope) {
        scope = makeScope();
        monthlyScopes.set(key, scope);
      }
      scope.total.amount += prod.amount;
      const method = prod.paymentMethod as PaymentMethod;
      if (method === "mixed" && (prod as any).mixedCardAmount && (prod as any).mixedCashAmount) {
        scope.methods.card.amount += (prod as any).mixedCardAmount;
        scope.methods.cash.amount += (prod as any).mixedCashAmount;
        yearlyScope.methods.card.amount += (prod as any).mixedCardAmount;
        yearlyScope.methods.cash.amount += (prod as any).mixedCashAmount;
      } else if (scope.methods[method]) {
        scope.methods[method].amount += prod.amount;
        if (yearlyScope.methods[method]) {
          yearlyScope.methods[method].amount += prod.amount;
        }
      }
      yearlyScope.total.amount += prod.amount;
      monthlyProductCounts.set(key, (monthlyProductCounts.get(key) || 0) + 1);
      yearlyProductCount++;
    }
    const months: { month: string; amount: number; count: number; salary: number; productCount: number }[] = [];
    const hasExplicitYear = Number.isFinite(qYear);
    const lastMonth = hasExplicitYear ? 11 : now.getMonth();
    for (let m = 0; m <= lastMonth; m++) {
      const scope = monthlyScopes.get(m) || makeScope();
      const label = `${year}-${String(m + 1).padStart(2, "0")}`;
      months.push({ month: label, amount: scope.total.amount, count: scope.total.count, salary: monthlySalaryTotals.get(m) ?? 0, productCount: monthlyProductCounts.get(m) ?? 0 });
    }
    res.json({ months, total: yearlyScope.total, methods: yearlyScope.methods, salaryTotal: yearlySalaryTotal, yearlyProductCount });
  } catch (error) {
    console.error('Error generating report by month:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const exportByDayCSV: RequestHandler = async (req, res) => {
  try {
    const salonId = getSalonId(req);
    const now = new Date();
    const q = req.query as any;
    const qYear = Number(q.year);
    const qMonth = Number(q.month);
    const year = Number.isFinite(qYear) ? qYear : now.getFullYear();
    const monthIdx = Number.isFinite(qMonth) && qMonth >= 1 && qMonth <= 12 ? qMonth - 1 : now.getMonth();
    const startDate = new Date(year, monthIdx, 1);
    const endDate = new Date(year, monthIdx + 1, 0);
    const end = (Number.isFinite(qYear) && Number.isFinite(qMonth)) ? endDate.getTime() : now.getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    const totals = new Map<number, { amount: number; count: number }>();

    const prestations = await Prestation.find({ salonId });
    for (const p of prestations) {
      const d = new Date(p.timestamp);
      if (d.getFullYear() !== year || d.getMonth() !== monthIdx) continue;
      const dStart = startOfDayParis(p.timestamp);
      const isTip = p.serviceName === "Pourboire";
      const isCashTip = isTip && p.paymentMethod === "cash";
      const cur = totals.get(dStart) || { amount: 0, count: 0 };
      if (!isCashTip) {
        cur.amount += p.amount;
      }
      cur.count += 1;
      totals.set(dStart, cur);
    }
    const rows: string[] = [];
    rows.push(["date", "nombre", "montant_eur"].join(","));
    for (let t = startDate.getTime(); t <= end; t += dayMs) {
      const key = startOfDayParis(t);
      const v = totals.get(key) || { amount: 0, count: 0 };
      const iso = formatParisISODate(key);
      rows.push([iso, String(v.count), v.amount.toFixed(2)].join(","));
    }
    const csv = rows.join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=rapport-mensuel-${year}-${String(monthIdx + 1).padStart(2, '0')}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting by day CSV:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const exportByDayPDF: RequestHandler = async (req, res) => {
  try {
    const salonId = getSalonId(req);
    const now = new Date();
    const q = req.query as any;
    const qYear = Number(q.year);
    const qMonth = Number(q.month);
    const year = Number.isFinite(qYear) ? qYear : now.getFullYear();
    const monthIdx = Number.isFinite(qMonth) && qMonth >= 1 && qMonth <= 12 ? qMonth - 1 : now.getMonth();
    const startDate = new Date(year, monthIdx, 1);
    const endDate = new Date(year, monthIdx + 1, 0);
    const end = (Number.isFinite(qYear) && Number.isFinite(qMonth)) ? endDate.getTime() : now.getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    const totals = new Map<number, { amount: number; count: number }>();

    const prestations = await Prestation.find({ salonId });
    for (const p of prestations) {
      const d = new Date(p.timestamp);
      if (d.getFullYear() !== year || d.getMonth() !== monthIdx) continue;
      const dStart = startOfDayParis(p.timestamp);
      const isTip = p.serviceName === "Pourboire";
      const isCashTip = isTip && p.paymentMethod === "cash";
      const cur = totals.get(dStart) || { amount: 0, count: 0 };
      if (!isCashTip) {
        cur.amount += p.amount;
      }
      cur.count += 1;
      totals.set(dStart, cur);
    }
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    let y = 800;
    const drawText = (text: string, options: Parameters<typeof page.drawText>[1]) => {
      page.drawText(sanitizePdfText(text), options);
    };
    drawText(`Rapport CA - Mois ${year}-${String(monthIdx + 1).padStart(2, "0")}`, {
      x: 40,
      y,
      size: 14,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= 30;
    const headers = ["Date", "Nombre", "Montant (EUR)"];
    const startX = 30;
    const colW = [140, 100, 140];
    const drawRow = (vals: string[]) => {
      const safe = sanitizePdfRow(vals);
      safe.forEach((v, i) => {
        drawText(v, {
          x: startX + colW.slice(0, i).reduce((a, b) => a + b, 0),
          y,
          size: 9,
          font,
          color: rgb(0, 0, 0),
        });
      });
      y -= 12;
    };
    drawText(headers[0], { x: startX, y, size: 9, font, color: rgb(0, 0, 0) });
    drawText(headers[1], { x: startX + colW[0], y, size: 9, font, color: rgb(0, 0, 0) });
    drawText(headers[2], { x: startX + colW[0] + colW[1], y, size: 9, font, color: rgb(0, 0, 0) });
    y -= 12;
    for (let t = startDate.getTime(); t <= end; t += dayMs) {
      const key = startOfDayParis(t);
      const v = totals.get(key) || { amount: 0, count: 0 };
      const iso = formatParisISODate(key);
      drawRow([iso, String(v.count), v.amount.toFixed(2)]);
    }
    const bytes = await pdf.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=rapport-mensuel-${year}-${String(monthIdx + 1).padStart(2, '0')}.pdf`);
    res.send(Buffer.from(bytes));
  } catch (error) {
    console.error('Error exporting by day PDF:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const exportByMonthCSV: RequestHandler = async (req, res) => {
  try {
    const salonId = getSalonId(req);
    const now = new Date();
    const qYear = Number((req.query as any).year);
    const year = Number.isFinite(qYear) ? qYear : now.getFullYear();
    const totals = new Map<number, { amount: number; count: number }>();

    const prestations = await Prestation.find({ salonId });
    for (const p of prestations) {
      const d = new Date(p.timestamp);
      if (d.getFullYear() !== year) continue;
      const key = d.getMonth();
      const cur = totals.get(key) || { amount: 0, count: 0 };
      cur.amount += p.amount;
      cur.count += 1;
      totals.set(key, cur);
    }
    const rows: string[] = [];
    rows.push(["mois", "nombre", "montant_eur"].join(","));
    for (let m = 0; m <= 11; m++) {
      const v = totals.get(m) || { amount: 0, count: 0 };
      const label = `${year}-${String(m + 1).padStart(2, "0")}`;
      rows.push([label, String(v.count), v.amount.toFixed(2)].join(","));
    }
    const csv = rows.join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=rapport-annuel-${year}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting by month CSV:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const exportByMonthPDF: RequestHandler = async (req, res) => {
  try {
    const salonId = getSalonId(req);
    const now = new Date();
    const qYear = Number((req.query as any).year);
    const year = Number.isFinite(qYear) ? qYear : now.getFullYear();
    const totals = new Map<number, { amount: number; count: number }>();

    const prestations = await Prestation.find({ salonId });
    for (const p of prestations) {
      const d = new Date(p.timestamp);
      if (d.getFullYear() !== year) continue;
      const key = d.getMonth();
      const cur = totals.get(key) || { amount: 0, count: 0 };
      cur.amount += p.amount;
      cur.count += 1;
      totals.set(key, cur);
    }
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    let y = 800;
    const drawText = (text: string, options: Parameters<typeof page.drawText>[1]) => {
      page.drawText(sanitizePdfText(text), options);
    };
    drawText(`Rapport CA - Année ${year}`, { x: 40, y, size: 14, font, color: rgb(0.2, 0.2, 0.2) });
    y -= 30;
    const headers = ["Mois", "Nombre", "Montant (EUR)"];
    const startX = 30;
    const colW = [140, 100, 140];
    const drawRow = (vals: string[]) => {
      const safe = sanitizePdfRow(vals);
      safe.forEach((v, i) => {
        drawText(v, {
          x: startX + colW.slice(0, i).reduce((a, b) => a + b, 0),
          y,
          size: 9,
          font,
          color: rgb(0, 0, 0),
        });
      });
      y -= 12;
    };
    drawText(headers[0], { x: startX, y, size: 9, font, color: rgb(0, 0, 0) });
    drawText(headers[1], { x: startX + colW[0], y, size: 9, font, color: rgb(0, 0, 0) });
    drawText(headers[2], { x: startX + colW[0] + colW[1], y, size: 9, font, color: rgb(0, 0, 0) });
    y -= 12;
    for (let m = 0; m <= 11; m++) {
      const v = totals.get(m) || { amount: 0, count: 0 };
      const label = `${year}-${String(m + 1).padStart(2, "0")}`;
      drawRow([label, String(v.count), v.amount.toFixed(2)]);
    }
    const bytes = await pdf.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=rapport-annuel-${year}.pdf`);
    res.send(Buffer.from(bytes));
  } catch (error) {
    console.error('Error exporting by month PDF:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export {
  connectDatabase
};

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'barberpro-clients',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
  } as any,
});

const upload = multer({ storage: storage });

export const uploadClientPhoto = [
  upload.single('photo'),
  async (req: any, res: any) => {
    try {
      const salonId = getSalonId(req);
      const { id } = req.params;

      if (!req.file || !req.file.path) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const client = await Client.findOne({ id, salonId });
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      client.photos.push(req.file.path);
      await client.save();

      res.json({ client });
    } catch (error) {
      console.error('Error uploading client photo:', error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
];

export const deleteClientPhoto: RequestHandler = async (req, res) => {
  try {
    const salonId = getSalonId(req);
    const { id } = req.params;
    const { photoUrl } = await parseRequestBody(req);

    if (!photoUrl) {
      return res.status(400).json({ error: "Photo URL is required" });
    }

    const client = await Client.findOne({ id, salonId });
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    client.photos = client.photos.filter(p => p !== photoUrl);
    await client.save();

    try {
      const urlParts = photoUrl.split('/');
      const filename = urlParts[urlParts.length - 1];
      const publicIdWithExtension = filename.split('.')[0];
      const folder = urlParts[urlParts.length - 2];
      const publicId = `${folder}/${publicIdWithExtension}`;
      await cloudinary.uploader.destroy(publicId);
    } catch (cloudinaryError) {
      console.error('Error deleting from Cloudinary:', cloudinaryError);
    }

    res.json({ client });
  } catch (error) {
    console.error('Error deleting client photo:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};