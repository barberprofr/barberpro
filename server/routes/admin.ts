import { IncomingMessage } from "node:http";
import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { AdminUser, Settings, Stylist, Client, Prestation, PointsRedemption, Service, ProductType, Product } from "./models.ts";
import { rateLimitSuperAdmin, recordLoginAttempt } from "../middleware/rateLimitSuperAdmin.ts";
import { logSuperAdminAction } from "../middleware/auditLog.ts";
import { EmailService } from "./emailService.ts";

const router = Router();

// Parser manuel pour gérer les environnements serverless/proxies
async function parseRequestBody(req: any): Promise<any> {
    return new Promise((resolve, reject) => {
        try {
            const body = (req as any)?.body;

            // Cas 1: Déjà parsé et non vide
            if (body && typeof body === 'object' && !Buffer.isBuffer(body) && Object.keys(body).length > 0) {
                return resolve(body);
            }

            // Cas 2: Buffer (Netlify parfois)
            if (Buffer.isBuffer(body)) {
                try {
                    const bodyString = body.toString('utf8');
                    const parsed = bodyString ? JSON.parse(bodyString) : {};
                    return resolve(parsed);
                } catch (error) {
                    return reject(new Error('Invalid JSON from Buffer'));
                }
            }

            // Cas 3: Objet vide (express.json() a peut-être déjà consommé le stream mais rien trouvé)
            // On tente quand même de lire le stream si on peut, mais risque de hang.
            // Dans le doute, on retourne {} si c'est déjà un objet vide, car lire le stream fermera la req.
            if (body && typeof body === 'object' && Object.keys(body).length === 0) {
                return resolve({});
            }

            // Cas 4: Lecture manuelle du stream (si body est undefined ou autre)
            let data = '';
            (req as IncomingMessage).on('data', chunk => { data += chunk.toString(); });
            (req as IncomingMessage).on('end', () => {
                try {
                    if (data) {
                        resolve(JSON.parse(data));
                    } else {
                        resolve({});
                    }
                } catch (error) {
                    reject(new Error('Invalid JSON'));
                }
            });
            (req as IncomingMessage).on('error', (error) => {
                reject(error);
            });
        } catch (e) {
            reject(e);
        }
    });
}

function sha256(s: string) {
    return createHash("sha256").update(s).digest("hex");
}

function makeToken() {
    return randomBytes(16).toString("hex");
}

async function requireSuperAdmin(req: any, res: any, next: any) {
    const token = req.header("x-super-admin-token");
    if (!token) {
        return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const admin = await AdminUser.findOne({ token });
    if (!admin) {
        return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    // ✅ VÉRIFIER EXPIRATION (1 heure)
    if (admin.tokenExpiresAt && Date.now() > admin.tokenExpiresAt) {
        console.warn(`⚠️ Expired token for ${admin.email}`);
        return res.status(401).json({ error: "Token expired. Please login again." });
    }

    req.adminUser = admin;
    next();
}

// Routes

// 1. Initial Seed
router.post("/seed", async (req, res) => {
    try {
        // ✅ BLOQUER EN PRODUCTION
        if (process.env.NODE_ENV === 'production' || process.env.ALLOW_SEED !== 'true') {
            console.warn('⚠️ Attempt to access /seed route in production');
            return res.status(403).json({ error: "Seed route disabled in production" });
        }

        // Attempt parse
        let parsedBody = await parseRequestBody(req);

        // Merge with query params just in case
        let { email, password } = parsedBody;
        if (!email) email = req.query.email;
        if (!password) password = req.query.password;

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password required" });
        }

        // Normaliser
        email = email.toString().trim().toLowerCase();

        const existingCount = await AdminUser.countDocuments();
        if (existingCount > 0) {
            // Check if it's the SAME admin trying to re-seed? No, security risk.
            return res.status(403).json({ error: "Admin already exists. Use the login route." });
        }

        const admin = new AdminUser({
            email,
            passwordHash: sha256(password),
            token: makeToken()
        });

        await admin.save();
        res.json({ token: admin.token, message: "Admin created successfully" });
    } catch (error) {
        console.error("Seed error:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// 2. Login
router.post("/login", rateLimitSuperAdmin, async (req, res) => {
    try {
        const parsedBody = await parseRequestBody(req);
        let { email, password } = parsedBody;

        if (!email || !password) return res.status(400).json({ error: "Email and password required" });

        email = email.toString().trim().toLowerCase();
        const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';

        const admin = await AdminUser.findOne({ email });

        if (!admin) {
            await logSuperAdminAction('SUPERADMIN_LOGIN_FAILED', email, req, false, { reason: 'user_not_found' });
            recordLoginAttempt(ip, false);
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // ✅ MIGRATION PROGRESSIVE SHA256 → bcrypt
        let passwordValid = false;
        const version = admin.passwordVersion || 1;

        if (version === 1) {
            // Ancien système SHA256
            passwordValid = admin.passwordHash === sha256(password);

            if (passwordValid) {
                // ✅ MIGRER AUTOMATIQUEMENT vers bcrypt
                console.log(`🔄 Migrating ${email} from SHA256 to bcrypt`);
                admin.passwordHash = await bcrypt.hash(password, 12);
                admin.passwordVersion = 2;
            }
        } else if (version === 2) {
            // Nouveau système bcrypt
            passwordValid = await bcrypt.compare(password, admin.passwordHash);
        }

        if (!passwordValid) {
            await logSuperAdminAction('SUPERADMIN_LOGIN_FAILED', email, req, false, { reason: 'invalid_password' });
            recordLoginAttempt(ip, false);
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // ✅ SI MFA ACTIVÉ, GÉNÉRER ET ENVOYER CODE
        if (admin.mfaEnabled) {
            const mfaCode = EmailService.generateMFACode();
            admin.mfaCode = mfaCode;
            admin.mfaCodeExpiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes
            await admin.save();

            try {
                await EmailService.sendSuperAdminMFACode(admin.email, mfaCode);
                await logSuperAdminAction('MFA_CODE_SENT', email, req, true);
                return res.json({
                    mfaRequired: true,
                    message: "Verification code sent to your email"
                });
            } catch (error) {
                console.error('Failed to send MFA code:', error);
                return res.status(500).json({ error: "Failed to send verification code" });
            }
        }

        // ✅ PAS DE MFA: Générer token directement
        admin.token = makeToken();
        admin.tokenExpiresAt = Date.now() + (60 * 60 * 1000); // 1 heure
        await admin.save();

        await logSuperAdminAction('SUPERADMIN_LOGIN_SUCCESS', email, req, true);
        recordLoginAttempt(ip, true);

        res.json({ token: admin.token, expiresAt: admin.tokenExpiresAt });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Server error" });
    }
});

const SUBSCRIPTION_PRICE = 29;

// 3. Me (Verify Token)
router.get("/me", requireSuperAdmin, async (req: any, res) => {
    try {
        const admin = req.adminUser;
        res.json({
            email: admin.email,
            mfaEnabled: admin.mfaEnabled || false,
            updatedAt: admin.updatedAt,
            createdAt: admin.createdAt
        });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

// 4. Change Password
router.put("/change-password", requireSuperAdmin, async (req, res) => {
    try {
        const parsedBody = await parseRequestBody(req);
        const { currentPassword, newPassword } = parsedBody;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: "Current and new passwords required" });
        }

        // ✅ VALIDATION MOT DE PASSE FORT
        if (newPassword.length < 12) {
            return res.status(400).json({ error: "Password must be at least 12 characters long" });
        }

        const hasUpperCase = /[A-Z]/.test(newPassword);
        const hasLowerCase = /[a-z]/.test(newPassword);
        const hasNumber = /[0-9]/.test(newPassword);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

        if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecial) {
            return res.status(400).json({
                error: "Password must contain uppercase, lowercase, number, and special character"
            });
        }

        const admin = (req as any).adminUser;

        // ✅ VÉRIFIER ANCIEN MOT DE PASSE
        let oldPasswordValid = false;
        const version = admin.passwordVersion || 1;

        if (version === 1) {
            oldPasswordValid = admin.passwordHash === sha256(currentPassword);
        } else if (version === 2) {
            oldPasswordValid = await bcrypt.compare(currentPassword, admin.passwordHash);
        }

        if (!oldPasswordValid) {
            await logSuperAdminAction('PASSWORD_CHANGE_FAILED', admin.email, req, false, { reason: 'invalid_old_password' });
            return res.status(401).json({ error: "Invalid old password" });
        }

        // ✅ HASHER NOUVEAU MOT DE PASSE AVEC BCRYPT
        admin.passwordHash = await bcrypt.hash(newPassword, 12);
        admin.passwordVersion = 2;

        // ✅ RÉVOQUER ANCIEN TOKEN, GÉNÉRER NOUVEAU
        admin.token = makeToken();
        admin.tokenExpiresAt = Date.now() + (60 * 60 * 1000); // 1 heure

        await admin.save();

        await logSuperAdminAction('PASSWORD_CHANGE_SUCCESS', admin.email, req, true);

        res.json({
            message: "Password changed successfully",
            token: admin.token,
            expiresAt: admin.tokenExpiresAt
        });
    } catch (error) {
        console.error("Change password error:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// 5. Verify MFA Code
router.post("/verify-mfa", rateLimitSuperAdmin, async (req, res) => {
    try {
        const parsedBody = await parseRequestBody(req);
        const { email, code } = parsedBody;

        if (!email || !code) {
            return res.status(400).json({ error: "Email and code required" });
        }

        const admin = await AdminUser.findOne({ email: email.toString().trim().toLowerCase() });

        if (!admin) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // ✅ VÉRIFIER CODE MFA
        if (!admin.mfaCode || !admin.mfaCodeExpiresAt) {
            return res.status(400).json({ error: "No verification code found. Please login again." });
        }

        if (Date.now() > admin.mfaCodeExpiresAt) {
            await logSuperAdminAction('MFA_VERIFY_FAILED', admin.email, req, false, { reason: 'code_expired' });
            return res.status(401).json({ error: "Verification code expired. Please login again." });
        }

        if (admin.mfaCode !== code.toString().trim()) {
            await logSuperAdminAction('MFA_VERIFY_FAILED', admin.email, req, false, { reason: 'invalid_code' });
            return res.status(401).json({ error: "Invalid verification code" });
        }

        // ✅ CODE VALIDE: Générer token
        admin.token = makeToken();
        admin.tokenExpiresAt = Date.now() + (60 * 60 * 1000); // 1 heure
        admin.mfaCode = null; // Effacer le code utilisé
        admin.mfaCodeExpiresAt = null;
        await admin.save();

        await logSuperAdminAction('MFA_VERIFY_SUCCESS', admin.email, req, true);

        res.json({ token: admin.token, expiresAt: admin.tokenExpiresAt });
    } catch (error) {
        console.error("Verify MFA error:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// 6. Enable MFA
router.post("/enable-mfa", requireSuperAdmin, async (req, res) => {
    try {
        const admin = (req as any).adminUser;

        if (admin.mfaEnabled) {
            return res.status(400).json({ error: "MFA already enabled" });
        }

        admin.mfaEnabled = true;
        await admin.save();

        await logSuperAdminAction('MFA_ENABLED', admin.email, req, true);

        res.json({ message: "MFA enabled successfully" });
    } catch (error) {
        console.error("Enable MFA error:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// 7. Disable MFA
router.post("/disable-mfa", requireSuperAdmin, async (req, res) => {
    try {
        const admin = (req as any).adminUser;

        if (!admin.mfaEnabled) {
            return res.status(400).json({ error: "MFA not enabled" });
        }

        admin.mfaEnabled = false;
        admin.mfaCode = null;
        admin.mfaCodeExpiresAt = null;
        await admin.save();

        await logSuperAdminAction('MFA_DISABLED', admin.email, req, true);

        res.json({ message: "MFA disabled successfully" });
    } catch (error) {
        console.error("Disable MFA error:", error);
        res.status(500).json({ error: "Server error" });
    }
});

router.get("/stats", requireSuperAdmin, async (req, res) => {
    try {
        const [
            totalSalons,
            paidSalons,
            trialSalons,
        ] = await Promise.all([
            Settings.countDocuments(),
            Settings.countDocuments({ subscriptionStatus: { $in: ["active", "paid"] } }),
            Settings.countDocuments({ subscriptionStatus: "trialing" }),
        ]);

        const estimatedRevenue = paidSalons * SUBSCRIPTION_PRICE;

        res.json({
            totalSalons,
            paidSalons,
            trialSalons,
            estimatedRevenue
        });
    } catch (error) {
        console.error("Stats error:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// 5. List Salons
router.get("/salons", requireSuperAdmin, async (req, res) => {
    try {
        const salons = await Settings.find().sort({ createdAt: -1 });
        res.json(salons);
    } catch (error) {
        console.error("List salons error:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// 6. Update Salon
router.put("/salons/:id", requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = await parseRequestBody(req);

        // Whitelist allowed updates
        const allowed = [
            "subscriptionStatus",
            "trialEndsAt",
            "trialStartedAt",
            "storeName",
            "salonName",
            "adminEmail",
            "accountEmail",
            "subscriptionStartedAt"
        ];

        const safeUpdates: any = {};
        for (const k of allowed) {
            if (k in updates) safeUpdates[k] = updates[k];
        }

        // Auto-set subscriptionStartedAt if activating and not set
        if (safeUpdates.subscriptionStatus === 'active') {
            const current = await Settings.findOne({ salonId: id });
            if (current && !current.subscriptionStartedAt) {
                safeUpdates.subscriptionStartedAt = Date.now();
            }
        }

        const salon = await Settings.findOneAndUpdate({ salonId: id }, { $set: safeUpdates }, { new: true });

        if (!salon) return res.status(404).json({ error: "Salon not found" });

        await logSuperAdminAction('SALON_UPDATE', (req as any).adminUser.email, req, true, {
            salonId: id,
            fields: Object.keys(safeUpdates)
        });

        res.json(salon);
    } catch (error) {
        console.error("Update salon error:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// 7. Delete Salon (Dangerous!)
router.delete("/salons/:id", requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const salonId = id;

        // Delete everything associated with this salon
        await Promise.all([
            Settings.deleteOne({ salonId }),
            Stylist.deleteMany({ salonId }),
            Client.deleteMany({ salonId }),
            Prestation.deleteMany({ salonId }),
            PointsRedemption.deleteMany({ salonId }),
            Service.deleteMany({ salonId }),
            ProductType.deleteMany({ salonId }),
            Product.deleteMany({ salonId }),
        ]);

        await logSuperAdminAction('SALON_DELETE', (req as any).adminUser.email, req, true, { salonId });

        res.json({ message: "Salon deleted successfully" });
    } catch (error) {
        console.error("Delete salon error:", error);
        res.status(500).json({ error: "Server error" });
    }
});

export const adminRouter = router;
