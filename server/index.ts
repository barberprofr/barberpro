import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { adminRouter } from "./routes/admin";
export { connectDatabase } from './db';
import { addClient, addStylist, adminLogin, createPrestation, createProduct, listProducts, exportSummaryCSV, exportSummaryPDF, getConfig, getStylistBreakdown, getGlobalBreakdown, listClients, listStylists, getStylistsByPriority, pointsUsageReport, redeemPoints, reportByDay, reportByMonth, setAdminPassword, setStylistCommission, summaryReport, updateConfig, deleteStylist, deleteClient, recoverAdminPassword, recoverAdminVerify, exportStylistCSV, exportStylistPDF, exportByDayCSV, exportByDayPDF, exportByMonthCSV, exportByMonthPDF, setupAdminAccount, verifyAdminCode, updateStylist, listServices, addService, deleteService, reorderServices, listProductTypes, addProductType, deleteProductType, reorderProductTypes, recoverAdminCode, verifyAdminCodeRecovery, addPoints, updateTransactionPaymentMethod, uploadClientPhoto, deleteClientPhoto, setStylistSecretCode, verifyStylistSecretCode, getStylistHasSecretCode, addStylistDeposit, listStylistDeposits, deleteStylistDeposit, deletePrestation } from "./routes/salon";
import { createCheckoutSession, createPortalSession, webhookHandler } from "./routes/payment";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "x-admin-token",
      "x-super-admin-token", // ✅ AJOUTÉ pour super admin
    ],
    exposedHeaders: ["Content-Disposition"],
  }));
  // Stripe webhooks require the raw body; mount the webhook route with raw parser before json body parser
  // Mount webhook route with raw body parser
  const webhookMiddleware = express.raw({ type: "application/json" });
  const webhookHandlerWrapper = (req: any, res: any, next: any) => {
    console.log('🎯 Webhook called at path:', req.path);
    // attach rawBody for handler convenience
    req.rawBody = req.body;
    return webhookHandler(req, res, next);
  };

  // Mount webhook route for both paths
  app.post("/api/webhook", webhookMiddleware, webhookHandlerWrapper);
  app.post("/.netlify/functions/api/webhook", webhookMiddleware, webhookHandlerWrapper);

  // mount other payment routes
  app.post("/api/create-checkout-session", createCheckoutSession);
  app.post("/api/create-portal-session", createPortalSession);

  // mount payment routes in multi-salon namespace
  app.post("/api/salons/:salonId/create-checkout-session", createCheckoutSession);
  app.post("/api/salons/:salonId/create-portal-session", createPortalSession);

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
  app.get("/api/stylists/priority", getStylistsByPriority);
  app.post("/api/stylists", addStylist);
  app.delete("/api/stylists/:id", deleteStylist);
  app.put("/api/stylists/:id/secret-code", setStylistSecretCode);
  app.post("/api/stylists/:id/verify-code", verifyStylistSecretCode);
  app.get("/api/stylists/:id/has-code", getStylistHasSecretCode);
  app.get("/api/stylist-deposits", listStylistDeposits);
  app.post("/api/stylist-deposits", addStylistDeposit);
  app.delete("/api/stylist-deposits/:depositId", deleteStylistDeposit);
  app.get("/api/clients", listClients);
  app.post("/api/clients", addClient);
  app.delete("/api/clients/:id", deleteClient);
  app.post("/api/clients/:id/photos", uploadClientPhoto as any);
  app.delete("/api/clients/:id/photos", deleteClientPhoto as any);
  app.get("/api/services", listServices);
  app.post("/api/services", addService);
  app.put("/api/services/reorder", reorderServices);
  app.delete("/api/services/:id", deleteService);
  app.get("/api/product-types", listProductTypes);
  app.post("/api/product-types", addProductType);
  app.put("/api/product-types/reorder", reorderProductTypes);
  app.delete("/api/product-types/:id", deleteProductType);
  app.post("/api/prestations", createPrestation);
  app.delete("/api/prestations/:id", deletePrestation);
  app.get("/api/products", listProducts);
  app.post("/api/products", createProduct);
  app.post("/api/clients/redeem", redeemPoints);
  app.get("/api/reports/summary", summaryReport);
  app.get("/api/reports/points-usage", pointsUsageReport);
  app.post("/api/clients/add-points", addPoints);
  app.post("/api/transactions/update-payment-method", updateTransactionPaymentMethod);
  app.get("/api/stylists/:id/breakdown", getStylistBreakdown);
  app.get("/api/reports/global-breakdown", getGlobalBreakdown);
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
  app.get("/api/salons/:salonId/stylists/priority", getStylistsByPriority);
  app.get("/api/salons/:salonId/stylists/:id/breakdown", getStylistBreakdown);
  app.post("/api/salons/:salonId/stylists", addStylist);
  app.delete("/api/salons/:salonId/stylists/:id", deleteStylist);
  app.put("/api/salons/:salonId/stylists/:id/secret-code", setStylistSecretCode);
  app.post("/api/salons/:salonId/stylists/:id/verify-code", verifyStylistSecretCode);
  app.get("/api/salons/:salonId/stylists/:id/has-code", getStylistHasSecretCode);
  app.get("/api/salons/:salonId/stylist-deposits", listStylistDeposits);
  app.post("/api/salons/:salonId/stylist-deposits", addStylistDeposit);
  app.delete("/api/salons/:salonId/stylist-deposits/:depositId", deleteStylistDeposit);
  app.get("/api/salons/:salonId/clients", listClients);
  app.post("/api/salons/:salonId/clients", addClient);
  app.delete("/api/salons/:salonId/clients/:id", deleteClient);
  app.post("/api/salons/:salonId/clients/:id/photos", uploadClientPhoto as any);
  app.delete("/api/salons/:salonId/clients/:id/photos", deleteClientPhoto as any);
  app.get("/api/salons/:salonId/services", listServices);
  app.post("/api/salons/:salonId/services", addService);
  app.put("/api/salons/:salonId/services/reorder", reorderServices);
  app.delete("/api/salons/:salonId/services/:id", deleteService);
  app.get("/api/salons/:salonId/product-types", listProductTypes);
  app.post("/api/salons/:salonId/product-types", addProductType);
  app.put("/api/salons/:salonId/product-types/reorder", reorderProductTypes);
  app.delete("/api/salons/:salonId/product-types/:id", deleteProductType);
  app.post("/api/salons/:salonId/prestations", createPrestation);
  app.delete("/api/salons/:salonId/prestations/:id", deletePrestation);
  app.get("/api/salons/:salonId/products", listProducts);
  app.post("/api/salons/:salonId/products", createProduct);
  app.post("/api/salons/:salonId/clients/redeem", redeemPoints);
  app.get("/api/salons/:salonId/reports/summary", summaryReport);
  app.get("/api/salons/:salonId/reports/global-breakdown", getGlobalBreakdown);
  app.get("/api/salons/:salonId/reports/points-usage", pointsUsageReport);
  app.post("/api/salons/:salonId/clients/add-points", addPoints);
  app.post("/api/salons/:salonId/transactions/update-payment-method", updateTransactionPaymentMethod);
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

  // Super Admin Routes (mounted last to avoid conflicting with salon routes)
  app.use("/api/superadmin", adminRouter);

  return app;
}
