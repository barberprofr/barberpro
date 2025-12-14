import mongoose, { Schema, Document } from 'mongoose';

export type PaymentMethod = "cash" | "check" | "card";

// Interfaces étendues pour Mongoose
export interface IStylist extends Document {
    id: string;
    name: string;
    commissionPct?: number;
    secretCode?: string;
    salonId: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface IAdminUser extends Document {
    email: string;
    passwordHash: string;
    token?: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface IClient extends Document {
    id: string;
    name: string;
    points: number;
    email: string | null;
    phone: string | null;
    lastVisitAt: number | null;
    salonId: string;
    createdAt: Date;
    updatedAt: Date;
    photos: string[];
}

export interface IPrestation extends Document {
    id: string;
    stylistId: string;
    clientId?: string;
    amount: number;
    paymentMethod: PaymentMethod;
    timestamp: number;
    pointsPercent: number;
    pointsAwarded: number;
    serviceName?: string;
    serviceId?: string;
    salonId: string;
    createdAt: Date;
}

export interface IPointsRedemption extends Document {
    id: string;
    stylistId: string;
    clientId: string;
    points: number;
    timestamp: number;
    reason: string;
    salonId: string;
    createdAt: Date;
}

export interface IService extends Document {
    id: string;
    name: string;
    price: number;
    description?: string;
    sortOrder: number;
    salonId: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface IProductType extends Document {
    id: string;
    name: string;
    price: number;
    description?: string;
    salonId: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface IProduct extends Document {
    id: string;
    stylistId: string;
    clientId?: string;
    amount: number;
    paymentMethod: PaymentMethod;
    timestamp: number;
    productName?: string;
    productTypeId?: string;
    salonId: string;
    createdAt: Date;
}

export interface ISettings extends Document {
    salonId: string;
    loginPasswordHash: string | null;
    adminCodeHash: string | null;
    adminToken: string | null;
    accountEmail: string; // Email de connexion (immutable)
    adminEmail: string | null; // Email de récupération (modifiable)
    salonName: string | null;
    salonAddress: string | null;
    salonPostalCode: string | null;
    salonCity: string | null;
    salonPhone: string | null;
    resetCode: string | null;
    resetExpiresAt: number;
    loyaltyPercentDefault: number;
    paymentModes: PaymentMethod[];
    commissionDefault: number;
    pointsRedeemDefault: number;
    // Payment / subscription fields
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    subscriptionStatus?: string | null;
    subscriptionCurrentPeriodEnd?: number | null;
    trialStartedAt?: number | null;
    trialEndsAt?: number | null;
    createdAt: Date;
    updatedAt: Date;
}

// Schémas Mongoose
const StylistSchema = new Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    commissionPct: { type: Number, min: 0, max: 100 },
    secretCode: { type: String, default: null },
    salonId: { type: String, required: true, index: true }
}, {
    timestamps: true,
    id: false
});

const ClientSchema = new Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    points: { type: Number, default: 0, min: 0 },
    email: { type: String, default: null },
    phone: { type: String, default: null },
    lastVisitAt: { type: Number, default: null },
    salonId: { type: String, required: true, index: true },
    photos: { type: [String], default: [] }
}, {
    timestamps: true,
    id: false
});

const PrestationSchema = new Schema({
    id: { type: String, required: true, unique: true },
    stylistId: { type: String, required: true, index: true },
    clientId: { type: String, index: true },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: {
        type: String,
        required: true,
        enum: ["cash", "check", "card"]
    },
    timestamp: { type: Number, required: true },
    pointsPercent: { type: Number, required: true, min: 0, max: 100 },
    pointsAwarded: { type: Number, required: true, min: 0 },
    serviceName: { type: String },
    serviceId: { type: String },
    salonId: { type: String, required: true, index: true }
}, {
    timestamps: { createdAt: true, updatedAt: false },
    id: false
});

const PointsRedemptionSchema = new Schema({
    id: { type: String, required: true, unique: true },
    stylistId: { type: String, required: true, index: true },
    clientId: { type: String, required: true, index: true },
    points: { type: Number, required: true, min: 0 },
    timestamp: { type: Number, required: true },
    reason: { type: String, required: true },
    salonId: { type: String, required: true, index: true }
}, {
    timestamps: { createdAt: true, updatedAt: false },
    id: false
});

const ServiceSchema = new Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    description: String,
    sortOrder: { type: Number, default: 0 },
    salonId: { type: String, required: true, index: true }
}, {
    timestamps: true,
    id: false
});

const ProductTypeSchema = new Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    description: String,
    salonId: { type: String, required: true, index: true }
}, {
    timestamps: true,
    id: false
});

const ProductSchema = new Schema({
    id: { type: String, required: true, unique: true },
    stylistId: { type: String, required: true, index: true },
    clientId: { type: String, index: true },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: {
        type: String,
        required: true,
        enum: ["cash", "check", "card"]
    },
    timestamp: { type: Number, required: true },
    productName: { type: String },
    productTypeId: { type: String },
    salonId: { type: String, required: true, index: true }
}, {
    timestamps: { createdAt: true, updatedAt: false },
    id: false
});

const SettingsSchema = new Schema({
    salonId: { type: String, required: true, unique: true },
    loginPasswordHash: { type: String, default: null },
    adminCodeHash: { type: String, default: null },
    adminToken: { type: String, default: null },
    accountEmail: { type: String, required: false }, // Will be required after migration
    adminEmail: { type: String, default: null },
    salonName: { type: String, default: null },
    salonAddress: { type: String, default: null },
    salonPostalCode: { type: String, default: null },
    salonCity: { type: String, default: null },
    salonPhone: { type: String, default: null },
    resetCode: { type: String, default: null },
    resetExpiresAt: { type: Number, default: 0 },
    loyaltyPercentDefault: { type: Number, default: 5, min: 0, max: 100 },
    paymentModes: [{
        type: String,
        enum: ["cash", "check", "card"]
    }],
    commissionDefault: { type: Number, default: 50, min: 0, max: 100 },
    pointsRedeemDefault: { type: Number, default: 10, min: 0 }
    ,
    // Subscription management (optional, for Stripe integration)
    stripeCustomerId: { type: String, default: null },
    stripeSubscriptionId: { type: String, default: null },
    subscriptionStatus: { type: String, default: null },
    subscriptionCurrentPeriodEnd: { type: Number, default: null },
    trialStartedAt: { type: Number, default: null },
    trialEndsAt: { type: Number, default: null }
}, {
    timestamps: true,
    id: false
});

// Index composés pour les performances
PrestationSchema.index({ salonId: 1, timestamp: -1 });
PrestationSchema.index({ salonId: 1, stylistId: 1, timestamp: -1 });
ProductSchema.index({ salonId: 1, timestamp: -1 });
PointsRedemptionSchema.index({ salonId: 1, timestamp: -1 });

const AdminUserSchema = new Schema({
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    token: { type: String, default: null }
}, {
    timestamps: true,
    id: false
});

// Modèles Mongoose
export const Stylist = (mongoose.models.Stylist || mongoose.model<IStylist>('Stylist', StylistSchema)) as mongoose.Model<IStylist>;
export const Client = (mongoose.models.Client || mongoose.model<IClient>('Client', ClientSchema)) as mongoose.Model<IClient>;
export const Prestation = (mongoose.models.Prestation || mongoose.model<IPrestation>('Prestation', PrestationSchema)) as mongoose.Model<IPrestation>;
export const PointsRedemption = (mongoose.models.PointsRedemption || mongoose.model<IPointsRedemption>('PointsRedemption', PointsRedemptionSchema)) as mongoose.Model<IPointsRedemption>;
export const Service = (mongoose.models.Service || mongoose.model<IService>('Service', ServiceSchema)) as mongoose.Model<IService>;
export const ProductType = (mongoose.models.ProductType || mongoose.model<IProductType>('ProductType', ProductTypeSchema)) as mongoose.Model<IProductType>;
export const Product = (mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema)) as mongoose.Model<IProduct>;
export const Settings = (mongoose.models.Settings || mongoose.model<ISettings>('Settings', SettingsSchema)) as mongoose.Model<ISettings>;
export const AdminUser = (mongoose.models.AdminUser || mongoose.model<IAdminUser>('AdminUser', AdminUserSchema)) as mongoose.Model<IAdminUser>;