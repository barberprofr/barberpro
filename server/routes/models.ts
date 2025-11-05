import mongoose, { Schema, Document } from 'mongoose';

export type PaymentMethod = "cash" | "check" | "card";

// Interfaces étendues pour Mongoose
export interface IStylist extends Document {
  id: string;
  name: string;
  commissionPct?: number;
  salonId: string;
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
  salonId: string;
  createdAt: Date;
}

export interface ISettings extends Document {
  salonId: string;
  loginPasswordHash: string | null;
  adminCodeHash: string | null;
  adminToken: string | null;
  adminEmail: string | null;
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
  createdAt: Date;
  updatedAt: Date;
}

// Schémas Mongoose
const StylistSchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  commissionPct: { type: Number, min: 0, max: 100 },
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
  salonId: { type: String, required: true, index: true }
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
  subscriptionCurrentPeriodEnd: { type: Number, default: null }
}, {
  timestamps: true,
  
  id: false
});

// Index composés pour les performances
PrestationSchema.index({ salonId: 1, timestamp: -1 });
PrestationSchema.index({ salonId: 1, stylistId: 1, timestamp: -1 });
ProductSchema.index({ salonId: 1, timestamp: -1 });
PointsRedemptionSchema.index({ salonId: 1, timestamp: -1 });

// Modèles Mongoose
export const Stylist = mongoose.model<IStylist>('Stylist', StylistSchema);
export const Client = mongoose.model<IClient>('Client', ClientSchema);
export const Prestation = mongoose.model<IPrestation>('Prestation', PrestationSchema);
export const PointsRedemption = mongoose.model<IPointsRedemption>('PointsRedemption', PointsRedemptionSchema);
export const Service = mongoose.model<IService>('Service', ServiceSchema);
export const ProductType = mongoose.model<IProductType>('ProductType', ProductTypeSchema);
export const Product = mongoose.model<IProduct>('Product', ProductSchema);
export const Settings = mongoose.model<ISettings>('Settings', SettingsSchema);