import { IncomingMessage } from "node:http";
import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";
import { AdminUser, Settings, Stylist, Client, Prestation, PointsRedemption, Service, ProductType, Product } from "./models.ts";

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

    req.adminUser = admin;
    next();
}

// Routes

// 1. Initial Seed
router.post("/seed", async (req, res) => {
    try {
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
router.post("/login", async (req, res) => {
    try {
        const parsedBody = await parseRequestBody(req);
        let { email, password } = parsedBody;

        if (!email || !password) return res.status(400).json({ error: "Email and password required" });

        email = email.toString().trim().toLowerCase();

        const admin = await AdminUser.findOne({ email });

        if (!admin) return res.status(401).json({ error: "Invalid credentials" });

        if (admin.passwordHash !== sha256(password)) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Refresh token
        admin.token = makeToken();
        await admin.save();

        res.json({ token: admin.token });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// 3. Me (Verify Token)
router.get("/me", requireSuperAdmin, async (req: any, res) => {
    res.json({ email: req.adminUser.email });
});

const SUBSCRIPTION_PRICE = 29;

// 4. Dashboard Stats
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
            "accountEmail"
        ];

        const safeUpdates: any = {};
        for (const k of allowed) {
            if (k in updates) safeUpdates[k] = updates[k];
        }

        const salon = await Settings.findOneAndUpdate({ salonId: id }, { $set: safeUpdates }, { new: true });

        if (!salon) return res.status(404).json({ error: "Salon not found" });

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

        res.json({ message: "Salon deleted successfully" });
    } catch (error) {
        console.error("Delete salon error:", error);
        res.status(500).json({ error: "Server error" });
    }
});

export const adminRouter = router;
