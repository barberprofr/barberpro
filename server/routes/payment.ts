import { RequestHandler } from "express";
import Stripe from "stripe";
import { Settings } from "./models";

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }
    _stripe = new Stripe(key, { apiVersion: "2025-04-30.basil" as any });
  }
  return _stripe;
}

// Create a Checkout Session for subscriptions
export const createCheckoutSession: RequestHandler = async (req, res) => {
  try {
    const salonId = (req.params && typeof req.params.salonId === "string" && req.params.salonId) || "main";
    const settings = await Settings.findOne({ salonId });
    if (!settings) return res.status(400).json({ error: "settings not found" });

    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) return res.status(500).json({ error: "STRIPE_PRICE_ID not configured" });

    // If we have an email, use it to create/retrieve customer
    let customerId = settings.stripeCustomerId ?? undefined;
    if (!customerId && settings.adminEmail) {
      // Create a Stripe customer
      const customer = await getStripe().customers.create({ email: settings.adminEmail });
      customerId = customer.id;
      settings.stripeCustomerId = customerId;
      await settings.save();
    }

    const protocol = req.headers["x-forwarded-proto"] || (req.protocol ? req.protocol : "https");
    const host = req.headers.host || process.env.FRONTEND_HOST || "local";
    const baseUrl = `${protocol}://${host}`;

    const successUrl = `${baseUrl}/app?checkout=success`;
    const cancelUrl = `${baseUrl}/app?checkout=cancel`;

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      billing_address_collection: "auto",
      metadata: { salonId },
      subscription_data: {
        metadata: { salonId }
      }
    });

    return res.json({ url: session.url, id: session.id });
  } catch (error: any) {
    console.error("Error creating checkout session:", error?.message || error);
    return res.status(500).json({ error: "unable to create checkout session" });
  }
};

// Create a Customer Portal session (optional)
export const createPortalSession: RequestHandler = async (req, res) => {
  try {
    const salonId = (req.params && typeof req.params.salonId === "string" && req.params.salonId) || "main";
    const settings = await Settings.findOne({ salonId });
    if (!settings || !settings.stripeCustomerId) return res.status(404).json({ error: "customer not found" });

    if (!process.env.STRIPE_PORTAL_RETURN_URL) return res.status(500).json({ error: "STRIPE_PORTAL_RETURN_URL not configured" });

    const session = await getStripe().billingPortal.sessions.create({
      customer: settings.stripeCustomerId,
      return_url: process.env.STRIPE_PORTAL_RETURN_URL
    });
    return res.json({ url: session.url });
  } catch (error) {
    console.error("Error creating portal session:", error);
    return res.status(500).json({ error: "unable to create portal session" });
  }
};

// Webhook to handle subscription events
export const webhookHandler: RequestHandler = async (req, res) => {
  const sig = req.headers["stripe-signature"] as string | undefined;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret || !sig) {
    console.warn("Webhook called without signature or secret");
    return res.status(400).send("missing webhook configuration");
  }

  let event;
  try {
    // req.body is raw buffer because route must be mounted with express.raw
    event = getStripe().webhooks.constructEvent((req as any).rawBody || req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err?.message || err);
    return res.status(400).send(`Webhook Error: ${err?.message || err}`);
  }

  try {
    const type = event.type;
    const data = event.data.object as any;

    if (type === "checkout.session.completed") {
      const session = data;
      // Attach customer and subscription to settings
      const customerId = session.customer;
      const subscriptionId = session.subscription;
      const salonId = session.metadata?.salonId ?? "main";

      console.log('📦 Webhook: checkout.session.completed', {
        customerId,
        subscriptionId,
        salonId,
        session: JSON.stringify(session)
      });

      const settings = await Settings.findOne({ salonId });
      if (settings) {
        console.log('✅ Found settings for salonId:', salonId);
        settings.stripeCustomerId = customerId ?? settings.stripeCustomerId;
        settings.stripeSubscriptionId = subscriptionId ?? settings.stripeSubscriptionId;
        settings.subscriptionStatus = "active";
        if (!settings.subscriptionStartedAt) {
          settings.subscriptionStartedAt = Date.now();
        }
        await settings.save();
        console.log('💾 Updated settings with subscription info');
      } else {
        console.error('❌ No settings found for salonId:', salonId);
      }
    }

    if (type === "invoice.payment_succeeded" || type === "customer.subscription.updated") {
      const sub = data;
      const subscriptionId = sub.id || sub.subscription?.id;
      const customerId = sub.customer;
      const status = sub.status ?? (data?.status);
      const currentPeriodEnd = (sub.current_period_end ? Number(sub.current_period_end) * 1000 : (sub.currentPeriodEnd ? Number(sub.currentPeriodEnd) : null));

      // Try to locate settings by stripeCustomerId or by metadata
      let settings = null;
      if (customerId) settings = await Settings.findOne({ stripeCustomerId: customerId });
      if (!settings && sub.metadata && sub.metadata.salonId) settings = await Settings.findOne({ salonId: sub.metadata.salonId });
      if (settings) {
        settings.stripeSubscriptionId = subscriptionId ?? settings.stripeSubscriptionId;
        // If status is 'paid' (from invoice), normalize to 'active'
        const normalizedStatus = status === 'paid' ? 'active' : status;
        settings.subscriptionStatus = normalizedStatus ?? settings.subscriptionStatus;
        if (normalizedStatus === 'active' && !settings.subscriptionStartedAt) {
          settings.subscriptionStartedAt = Date.now();
        }
        if (currentPeriodEnd) settings.subscriptionCurrentPeriodEnd = currentPeriodEnd;
        await settings.save();
      }
    }

    if (type === "invoice.payment_failed") {
      const inv = data;
      const customerId = inv.customer;
      const settings = customerId ? await Settings.findOne({ stripeCustomerId: customerId }) : null;
      if (settings) {
        settings.subscriptionStatus = "past_due";
        await settings.save();
      }
    }

    // Return a response to acknowledge receipt of the event
    res.json({ received: true });
  } catch (err) {
    console.error("Error handling webhook event:", err);
    res.status(500).send("internal error");
  }
};
