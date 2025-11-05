import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { connectDatabase } from './db';
import { addClient, addStylist, adminLogin, createPrestation, createProduct, listProducts, exportSummaryCSV, exportSummaryPDF, getConfig, getStylistBreakdown, listClients, listStylists, pointsUsageReport, redeemPoints, reportByDay, reportByMonth, setAdminPassword, setStylistCommission, summaryReport, updateConfig, deleteStylist, deleteClient, recoverAdminPassword, recoverAdminVerify, exportStylistCSV, exportStylistPDF, exportByDayCSV, exportByDayPDF, exportByMonthCSV, exportByMonthPDF, setupAdminAccount, verifyAdminCode, updateStylist, listServices, addService, deleteService, listProductTypes, addProductType, deleteProductType, recoverAdminCode, verifyAdminCodeRecovery } from "./routes/salon";

export function createServer() {
  const app = express();
  // Connexion à la base de données
  connectDatabase().then(() => {
    console.log('✅ Base de données connectée');
  }).catch((error) => {
    console.error('❌ Erreur de connexion à la base de données:', error);
    process.exit(1);
  });

  // Middleware
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "x-admin-token",
    ],
    exposedHeaders: ["Content-Disposition"],
  }));
  // Stripe webhooks require the raw body; mount the webhook route with raw parser before json body parser
  // We'll import the webhook handler and mount it below
  import("./routes/payment").then((mod) => {
    // Mount webhook route with raw body parser
    app.post("/api/webhook", express.raw({ type: "application/json" }), (req, res) => {
      // attach rawBody for handler convenience
      (req as any).rawBody = req.body;
      return (mod.webhookHandler as any)(req, res, () => undefined);
    });
    // mount other payment routes
    app.post("/api/create-checkout-session", mod.createCheckoutSession);
    app.post("/api/create-portal-session", mod.createPortalSession);
    
    // mount payment routes in multi-salon namespace
    app.post("/api/salons/:salonId/create-checkout-session", mod.createCheckoutSession);
    app.post("/api/salons/:salonId/create-portal-session", mod.createPortalSession);
  }).catch((err)=>{ console.error("Failed to load payment routes:", err); });

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Salon APIs (default namespace)
  app.get("/api/config", getConfig);
  app.post("/api/admin/setup", setupAdminAccount);
  app.post("/api/admin/set-password", setAdminPassword);
  app.post("/api/admin/code/verify", verifyAdminCode);
  app.post("/api/admin/login", adminLogin);
  app.post("/api/admin/recover", recoverAdminPassword);
  app.post("/api/admin/recover/verify", recoverAdminVerify);
  app.patch("/api/admin/config", updateConfig);
  app.patch("/api/admin/stylists/:id/commission", setStylistCommission);
  app.patch("/api/admin/stylists/:id", updateStylist);

  app.get("/api/stylists", listStylists);
  app.post("/api/stylists", addStylist);
  app.delete("/api/stylists/:id", deleteStylist);
  app.get("/api/clients", listClients);
  app.post("/api/clients", addClient);
  app.delete("/api/clients/:id", deleteClient);
  app.get("/api/services", listServices);
  app.post("/api/services", addService);
  app.delete("/api/services/:id", deleteService);
  app.get("/api/product-types", listProductTypes);
  app.post("/api/product-types", addProductType);
  app.delete("/api/product-types/:id", deleteProductType);
  app.post("/api/prestations", createPrestation);
  app.get("/api/products", listProducts);
  app.post("/api/products", createProduct);
  app.post("/api/clients/redeem", redeemPoints);
  app.get("/api/reports/summary", summaryReport);
  app.get("/api/reports/points-usage", pointsUsageReport);
  app.get("/api/stylists/:id/breakdown", getStylistBreakdown);
  app.get("/api/reports/summary.csv", exportSummaryCSV);
  app.get("/api/reports/summary.pdf", exportSummaryPDF);
  app.get("/api/reports/stylists/:id.csv", exportStylistCSV);
  app.get("/api/reports/stylists/:id.pdf", exportStylistPDF);
  app.get("/api/reports/by-day", reportByDay);
  app.get("/api/reports/by-day.csv", exportByDayCSV);
  app.get("/api/reports/by-day.pdf", exportByDayPDF);
  app.get("/api/reports/by-month", reportByMonth);
  app.get("/api/reports/by-month.csv", exportByMonthCSV);
  app.get("/api/reports/by-month.pdf", exportByMonthPDF);

  // Multi-salon namespace (data shared for now; salonId ignored by handlers)
  app.get("/api/salons/:salonId/config", getConfig);
  app.post("/api/salons/:salonId/admin/setup", setupAdminAccount);
  app.post("/api/salons/:salonId/admin/set-password", setAdminPassword);
  app.post("/api/salons/:salonId/admin/code/verify", verifyAdminCode);
  app.post("/api/salons/:salonId/admin/login", adminLogin);
  app.post("/api/salons/:salonId/admin/recover", recoverAdminPassword);
  app.post("/api/salons/:salonId/admin/recover/verify", recoverAdminVerify);
  app.patch("/api/salons/:salonId/admin/config", updateConfig);
  app.patch("/api/salons/:salonId/admin/stylists/:id/commission", setStylistCommission);
  app.patch("/api/salons/:salonId/admin/stylists/:id", updateStylist);

  app.get("/api/salons/:salonId/stylists", listStylists);
  app.get("/api/salons/:salonId/stylists/:id/breakdown", getStylistBreakdown);
  app.post("/api/salons/:salonId/stylists", addStylist);
  app.delete("/api/salons/:salonId/stylists/:id", deleteStylist);
  app.get("/api/salons/:salonId/clients", listClients);
  app.post("/api/salons/:salonId/clients", addClient);
  app.delete("/api/salons/:salonId/clients/:id", deleteClient);
  app.get("/api/salons/:salonId/services", listServices);
  app.post("/api/salons/:salonId/services", addService);
  app.delete("/api/salons/:salonId/services/:id", deleteService);
  app.get("/api/salons/:salonId/product-types", listProductTypes);
  app.post("/api/salons/:salonId/product-types", addProductType);
  app.delete("/api/salons/:salonId/product-types/:id", deleteProductType);
  app.post("/api/salons/:salonId/prestations", createPrestation);
  app.get("/api/salons/:salonId/products", listProducts);
  app.post("/api/salons/:salonId/products", createProduct);
  app.post("/api/salons/:salonId/clients/redeem", redeemPoints);
  app.get("/api/salons/:salonId/reports/summary", summaryReport);
  app.get("/api/salons/:salonId/reports/points-usage", pointsUsageReport);
  app.get("/api/salons/:salonId/reports/stylists/:id.csv", exportStylistCSV);
  app.get("/api/salons/:salonId/reports/stylists/:id.pdf", exportStylistPDF);
  app.get("/api/salons/:salonId/reports/summary.csv", exportSummaryCSV);
  app.get("/api/salons/:salonId/reports/summary.pdf", exportSummaryPDF);
  app.get("/api/salons/:salonId/reports/by-day", reportByDay);
  app.get("/api/salons/:salonId/reports/by-day.csv", exportByDayCSV);
  app.get("/api/salons/:salonId/reports/by-day.pdf", exportByDayPDF);
  app.get("/api/salons/:salonId/reports/by-month", reportByMonth);
  app.get("/api/salons/:salonId/reports/by-month.csv", exportByMonthCSV);
  app.get("/api/salons/:salonId/reports/by-month.pdf", exportByMonthPDF);

  // Routes pour la récupération du CODE ADMIN
app.post("/api/admin/recover-code", recoverAdminCode);
app.post("/api/admin/recover-code/verify", verifyAdminCodeRecovery);

// Et dans la section multi-salon :
app.post("/api/salons/:salonId/admin/recover-code", recoverAdminCode);
app.post("/api/salons/:salonId/admin/recover-code/verify", verifyAdminCodeRecovery);

  return app;
}
