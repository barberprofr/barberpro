import { RequestHandler } from "express";
import { createHash, randomBytes } from "node:crypto";
import { IncomingMessage } from "node:http";
import { EmailService } from './emailService.ts';
import {
  Stylist, Client, Prestation, PointsRedemption,
  Service, ProductType, Product, Settings,
  IStylist, IClient, IPrestation, IPointsRedemption,
  IService, IProductType, IProduct, ISettings,
  PaymentMethod
} from "./models.ts";

// Connexion à la base de données (à appeler au démarrage de l'application)
import { connectDatabase } from "../db.ts";

// Email -> SalonId mapping pour la récupération de compte
const emailToSalonId = new Map<string, string>();

// ⭐️ RÉINTÉGRATION : Système de période d'essai
const parsedTrialDays = Number(process.env.SUBSCRIPTION_TRIAL_DAYS ?? "1");
const TRIAL_DURATION_DAYS = Number.isFinite(parsedTrialDays) ? Math.max(0, parsedTrialDays) : 1;
const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;

// Parser manuel pour Netlify Functions - CORRIGÉ
async function parseRequestBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      console.log('🔍 [parseRequestBody] Début du parsing');
      const body = (req as any)?.body;
      console.log('🔍 [parseRequestBody] req.body exists:', !!body);
      console.log('🔍 [parseRequestBody] req.body type:', typeof body);

      // Déjà parsé (objet non vide)
      if (body && typeof body === 'object' && !Buffer.isBuffer(body) && Object.keys(body).length > 0) {
        console.log('🔍 [parseRequestBody] Body déjà parsé (objet normal):', Object.keys(body));
        return resolve(body);
      }

      // Buffer (cas Netlify)
      if (Buffer.isBuffer(body)) {
        console.log('🔍 [parseRequestBody] Body est un Buffer, conversion en string');
        try {
          const bodyString = body.toString('utf8');
          console.log('🔍 [parseRequestBody] Buffer converti en string:', bodyString.substring(0, 200));
          const parsed = bodyString ? JSON.parse(bodyString) : {};
          console.log('🔍 [parseRequestBody] JSON parsé avec succès:', typeof parsed === 'object' ? Object.keys(parsed) : typeof parsed);
          return resolve(parsed);
        } catch (error) {
          console.error('❌ [parseRequestBody] Erreur de parsing du Buffer:', error);
          return reject(new Error('Invalid JSON from Buffer'));
        }
      }

      // Objet vide
      if (body && typeof body === 'object' && Object.keys(body).length === 0) {
        console.log('🔍 [parseRequestBody] Body est un objet vide');
        return resolve({});
      }

      // Fallback: lecture du stream
      console.log('🔍 [parseRequestBody] Lecture manuelle du stream');
      let data = '';
      (req as IncomingMessage).on('data', chunk => { data += chunk.toString(); });
      (req as IncomingMessage).on('end', () => {
        try {
          console.log('🔍 [parseRequestBody] Données brutes reçues:', data.substring(0, 200));
          if (data) {
            const parsed = JSON.parse(data);
            console.log('🔍 [parseRequestBody] JSON parsé avec succès:', Object.keys(parsed));
            resolve(parsed);
          } else {
            console.log('🔍 [parseRequestBody] Aucune donnée reçue');
            resolve({});
          }
        } catch (error) {
          console.error('❌ [parseRequestBody] Erreur de parsing JSON:', error);
          console.error('❌ [parseRequestBody] Données reçues:', data);
          reject(new Error('Invalid JSON'));
        }
      });
      (req as IncomingMessage).on('error', (error) => {
        console.error('❌ [parseRequestBody] Erreur de stream:', error);
        reject(error);
      });
    } catch (e) {
      reject(e);
    }
  });
}

function getSalonId(req: any): string {
  const id = (req.params && typeof req.params.salonId === "string" && req.params.salonId) || "main";
  return id.toLowerCase();
}

async function getSettings(salonId: string): Promise<ISettings> {
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
    await settings.save();
  }

  if (settings.pointsRedeemDefault === 100) {
    settings.pointsRedeemDefault = 10;
    await settings.save();
  }

  return settings;
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
    } as Record<PaymentMethod, { amount: number; count: number }>,
  };
}



async function aggregateByPayment(salonId: string, stylistId: string, refNowMs: number = Date.now()) {
  const now = refNowMs;
  const todayStart = startOfDayParis(now);

  const [prestations, products] = await Promise.all([
    Prestation.find({ salonId, stylistId }),
    Product.find({ salonId, stylistId })
  ]);

  const daily = makeScope();
  const monthly = makeScope();
  const prestationDaily = makeScope();
  const prestationMonthly = makeScope();
  const dailyEntries: { id: string; amount: number; paymentMethod: PaymentMethod; timestamp: number; kind: "prestation" | "produit"; name?: string }[] = [];

  for (const p of prestations) {
    const inc = (scope: ReturnType<typeof makeScope>) => {
      scope.total.amount += p.amount;
      scope.total.count += 1;
      scope.methods[p.paymentMethod].amount += p.amount;
      scope.methods[p.paymentMethod].count += 1;
    };

    if (startOfDayParis(p.timestamp) === todayStart) {
      inc(daily);
      inc(prestationDaily);
      dailyEntries.push({
        id: p.id,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
        timestamp: p.timestamp,
        kind: "prestation",
        name: p.serviceName
      });
    }
    if (isSameMonthParis(p.timestamp, now)) {
      inc(monthly);
      inc(prestationMonthly);
    }
  }

  for (const prod of products) {
    const incAmount = (scope: ReturnType<typeof makeScope>) => {
      scope.total.amount += prod.amount;
      scope.methods[prod.paymentMethod].amount += prod.amount;
    };

    if (startOfDayParis(prod.timestamp) === todayStart) {
      incAmount(daily);
      dailyEntries.push({
        id: prod.id,
        amount: prod.amount,
        paymentMethod: prod.paymentMethod,
        timestamp: prod.timestamp,
        kind: "produit",
        name: prod.productName
      });
    }
    if (isSameMonthParis(prod.timestamp, now)) incAmount(monthly);
  }

  dailyEntries.sort((a, b) => b.timestamp - a.timestamp);

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

  return { daily, monthly, prestationDaily, prestationMonthly, dailyEntries, dailyProductCount, monthlyProductCount };
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
    const inc = (scope: ReturnType<typeof makeScope>) => {
      scope.total.amount += p.amount;
      scope.total.count += 1;
      scope.methods[p.paymentMethod].amount += p.amount;
      scope.methods[p.paymentMethod].count += 1;
    };

    if (startOfDayParis(p.timestamp) === todayStart) inc(daily);
    if (isSameMonthParis(p.timestamp, now)) inc(monthly);
  }

  for (const prod of products) {
    const incAmount = (scope: ReturnType<typeof makeScope>) => {
      scope.total.amount += prod.amount;
      scope.methods[prod.paymentMethod].amount += prod.amount;
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
        if (settings.subscriptionStatus !== "trialing") {
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

    foundSettings.adminToken = makeToken();
    await foundSettings.save();
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
    settings.adminToken = makeToken();
    await settings.save();
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
    const { loyaltyPercentDefault, paymentModes, commissionDefault, pointsRedeemDefault, salonName } = body as {
      loyaltyPercentDefault?: number;
      paymentModes?: PaymentMethod[];
      commissionDefault?: number;
      pointsRedeemDefault?: number;
      salonName?: string | null;
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

    await Settings.findOneAndUpdate({ salonId }, { $set: updates });
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
    const settings = await getSettings(salonId);
    const { stylistId, clientId, amount, paymentMethod, timestamp, pointsPercent, serviceName, serviceId } = body as {
      stylistId?: string;
      clientId?: string;
      amount?: number;
      paymentMethod?: PaymentMethod;
      timestamp?: number;
      pointsPercent?: number;
      serviceName?: string;
      serviceId?: string;
    };

    if (!stylistId || typeof amount !== "number" || !paymentMethod) {
      return res.status(400).json({ error: "stylistId, amount and paymentMethod are required" });
    }

    const stylist = await Stylist.findOne({ id: stylistId, salonId });
    if (!stylist) return res.status(404).json({ error: "stylist not found" });

    // Resolve clientId – if none provided, it remains undefined (optional)
    let finalClientId = clientId;
    if (finalClientId) {
      const client = await Client.findOne({ id: finalClientId, salonId });
      if (!client) {
        // If provided ID is invalid, treat as no client
        finalClientId = undefined;
      }
    }

    const ts = typeof timestamp === "number" ? timestamp : Date.now();
    const pct = typeof pointsPercent === "number" ? pointsPercent : (settings.loyaltyPercentDefault ?? 5);
    const points = 1; // Fixed 1 point per prestation

    const prestation = new Prestation({
      id: `p-${Math.random().toString(36).slice(2)}`,
      stylistId,
      clientId: finalClientId,
      amount,
      paymentMethod,
      timestamp: ts,
      pointsPercent: pct,
      pointsAwarded: points,
      serviceName,
      serviceId,
      salonId
    });

    await prestation.save();

    // Only award points if client is selected
    if (finalClientId) {
      await Client.findOneAndUpdate(
        { id: finalClientId, salonId },
        { $inc: { points } }
      );
    }

    const stylistStats = await aggregateForStylist(stylistId, salonId);
    const client = finalClientId ? await Client.findOne({ id: finalClientId, salonId }) : undefined;

    res.status(201).json({ prestation, stylistStats, client });
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

    const client = await Client.findOne({ id: clientId, salonId });
    if (!client) return res.status(404).json({ error: "client not found" });
    if (client.points < points) return res.status(400).json({ error: "insufficient points" });

    if (stylistId) {
      const stylist = await Stylist.findOne({ id: stylistId, salonId });
      if (!stylist) return res.status(404).json({ error: "stylist not found" });
    }

    await Client.findOneAndUpdate(
      { id: clientId, salonId },
      { $inc: { points: -points } }
    );

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
      await usage.save();
    }

    const updatedClient = await Client.findOne({ id: clientId, salonId });
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

export const getStylistBreakdown: RequestHandler = async (req, res) => {
  try {
    const salonId = getSalonId(req);
    const { id } = req.params as { id: string };

    const stylist = await Stylist.findOne({ id, salonId });
    if (!stylist) return res.status(404).json({ error: "stylist not found" });

    const q = req.query as any;
    const dateStr = typeof q.date === "string" ? q.date : undefined;
    let ref = Date.now();

    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split("-").map(Number);
      ref = Date.UTC(y, (m - 1), d, 12, 0, 0);
    }

    const data = await aggregateByPayment(salonId, id, ref);
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
    const { name, commissionPct } = body as { name?: string; commissionPct?: number };

    const stylist = await Stylist.findOne({ id, salonId });
    if (!stylist) return res.status(404).json({ error: "stylist not found" });
    if (name === undefined && commissionPct === undefined) {
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

export const listServices: RequestHandler = async (req, res) => {
  try {
    const salonId = getSalonId(req);
    const services = await Service.find({ salonId });
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
    const service = new Service({
      id,
      name: name.trim(),
      price,
      description: description ? String(description).trim() : undefined,
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

export const listProductTypes: RequestHandler = async (req, res) => {
  try {
    const salonId = getSalonId(req);
    const productTypes = await ProductType.find({ salonId });
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

export const createProduct: RequestHandler = async (req, res) => {
  try {
    const body = await parseRequestBody(req);
    const salonId = getSalonId(req);
    const { stylistId, clientId, amount, paymentMethod, timestamp, productName, productTypeId } = body as {
      stylistId?: string;
      clientId?: string;
      amount?: number;
      paymentMethod?: PaymentMethod;
      timestamp?: number;
      productName?: string;
      productTypeId?: string;
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
      const cur = totals.get(dStart) || { amount: 0, count: 0 };
      cur.amount += p.amount;
      cur.count += 1;
      totals.set(dStart, cur);

      const stylist = stylistMap.get(p.stylistId);
      const pct = typeof stylist?.commissionPct === "number" ? stylist.commissionPct : settings.commissionDefault;
      const salary = (p.amount * pct) / 100;
      monthlySalary += salary;
      salaryTotals.set(dStart, (salaryTotals.get(dStart) || 0) + salary);

      let scope = dailyMethodTotals.get(dStart);
      if (!scope) {
        scope = {
          cash: { amount: 0, count: 0 },
          check: { amount: 0, count: 0 },
          card: { amount: 0, count: 0 },
        };
        dailyMethodTotals.set(dStart, scope);
      }
      scope[p.paymentMethod].amount += p.amount;
      scope[p.paymentMethod].count += 1;

      monthlyTotals.total.amount += p.amount;
      monthlyTotals.total.count += 1;
      monthlyTotals.methods[p.paymentMethod].amount += p.amount;
      monthlyTotals.methods[p.paymentMethod].count += 1;
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
        };
        dailyMethodTotals.set(dStart, scope);
      }
      scope[prod.paymentMethod].amount += prod.amount;

      dailyProductCounts.set(dStart, (dailyProductCounts.get(dStart) || 0) + 1);

      monthlyTotals.total.amount += prod.amount;
      monthlyTotals.methods[prod.paymentMethod].amount += prod.amount;
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
      scope.total.amount += p.amount;
      scope.total.count += 1;
      scope.methods[p.paymentMethod].amount += p.amount;
      scope.methods[p.paymentMethod].count += 1;
      yearlyScope.total.amount += p.amount;
      yearlyScope.total.count += 1;
      yearlyScope.methods[p.paymentMethod].amount += p.amount;
      yearlyScope.methods[p.paymentMethod].count += 1;
      const stylist = stylistMap.get(p.stylistId);
      const pct = typeof stylist?.commissionPct === "number" ? stylist.commissionPct : settings.commissionDefault;
      const salary = (p.amount * pct) / 100;
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
      scope.methods[prod.paymentMethod].amount += prod.amount;
      yearlyScope.total.amount += prod.amount;
      yearlyScope.methods[prod.paymentMethod].amount += prod.amount;
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
      const cur = totals.get(dStart) || { amount: 0, count: 0 };
      cur.amount += p.amount;
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
      const cur = totals.get(dStart) || { amount: 0, count: 0 };
      cur.amount += p.amount;
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