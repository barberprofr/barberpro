import { Request, Response, NextFunction } from 'express';

interface LoginAttempt {
    ip: string;
    attempts: number;
    lastAttempt: number;
    blockedUntil?: number;
}

// En mémoire pour simplicité (OK pour serverless car par IP)
const attempts = new Map<string, LoginAttempt>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const BLOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export function rateLimitSuperAdmin(req: Request, res: Response, next: NextFunction) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
        || req.ip
        || 'unknown';

    const now = Date.now();

    let record = attempts.get(ip);

    // Nettoyer anciennes tentatives
    if (record && now - record.lastAttempt > WINDOW_MS) {
        attempts.delete(ip);
        record = undefined;
    }

    // Vérifier si bloqué
    if (record?.blockedUntil && now < record.blockedUntil) {
        const remainingMin = Math.ceil((record.blockedUntil - now) / 60000);
        console.warn(`🚫 Super admin login blocked for IP ${ip} (${remainingMin} min remaining)`);
        return res.status(429).json({
            error: `Too many login attempts. Try again in ${remainingMin} minutes.`
        });
    }

    // Passer au prochain middleware
    next();

    // Note: On incrémente APRÈS la tentative (dans la route login)
}

export function recordLoginAttempt(ip: string, success: boolean) {
    const now = Date.now();
    let record = attempts.get(ip);

    if (success) {
        // Succès = reset
        attempts.delete(ip);
        return;
    }

    // Échec = incrémenter
    if (!record) {
        record = { ip, attempts: 1, lastAttempt: now };
    } else {
        record.attempts++;
        record.lastAttempt = now;
    }

    // Bloquer si trop de tentatives
    if (record.attempts >= MAX_ATTEMPTS) {
        record.blockedUntil = now + BLOCK_DURATION_MS;
        console.warn(`🚫 IP ${ip} blocked after ${MAX_ATTEMPTS} failed attempts`);
    }

    attempts.set(ip, record);
}

// Cleanup périodique (optionnel, pour éviter fuite mémoire)
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of attempts.entries()) {
        if (now - record.lastAttempt > WINDOW_MS && (!record.blockedUntil || now > record.blockedUntil)) {
            attempts.delete(ip);
        }
    }
}, 60 * 60 * 1000); // Toutes les heures
