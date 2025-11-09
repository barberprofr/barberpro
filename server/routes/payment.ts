import { RequestHandler } from "express";
import Stripe from "stripe";
import { Settings } from "./models";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2022-11-15" });

// Helper function to check if a subscription status is valid (paid and active)
function isSubscriptionActive(status: string | null | undefined): boolean {
  if (!status) return false;
  // Stripe subscription statuses: active, trialing are valid
  // We also accept "paid" as a valid status (in case of custom handling)
  const validStatuses = ["active", "trialing", "paid"];
  return validStatuses.includes(status.toLowerCase());
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
      const customer = await stripe.customers.create({ email: settings.adminEmail });
      customerId = customer.id;
      settings.stripeCustomerId = customerId;
      await settings.save();
    }

    const protocol = req.headers["x-forwarded-proto"] || (req.protocol ? req.protocol : "https");
    const host = req.headers.host || process.env.FRONTEND_HOST || "local";
    const baseUrl = `${protocol}://${host}`;

    const successUrl = `${baseUrl}/app?checkout=success`;
    const cancelUrl = `${baseUrl}/app?checkout=cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      billing_address_collection: "auto",
      metadata: { salonId }, // Add salonId to session metadata
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

// Check subscription status manually (useful after payment when webhook might be delayed)
export const checkSubscriptionStatus: RequestHandler = async (req, res) => {
  try {
    const salonId = (req.params && typeof req.params.salonId === "string" && req.params.salonId) || "main";
    const settings = await Settings.findOne({ salonId });
    if (!settings) return res.status(404).json({ error: "settings not found" });

    let subscriptionId: string | null = null;
    let subscription: Stripe.Subscription | null = null;

    // If we have a stored ID, check what type it is
    if (settings.stripeSubscriptionId) {
      const storedId = settings.stripeSubscriptionId;
      
      // Check if it's an invoice ID (starts with "in_")
      if (storedId.startsWith("in_")) {
        try {
          console.log("Detected invoice ID, retrieving invoice to get subscription ID");
          const invoice = await stripe.invoices.retrieve(storedId) as any;
          subscriptionId = (typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id) || null;
          
          if (subscriptionId) {
            console.log("Found subscription ID from invoice:", subscriptionId);
            // Update the stored ID to be the subscription ID
            settings.stripeSubscriptionId = subscriptionId;
            await settings.save();
          }
        } catch (err: any) {
          console.error("Error retrieving invoice:", err?.message || err);
        }
      } 
      // Check if it's a subscription ID (starts with "sub_")
      else if (storedId.startsWith("sub_")) {
        subscriptionId = storedId;
      }
    }

    // If we have a subscription ID, retrieve it
    if (subscriptionId) {
      try {
        subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const status = subscription.status;
        const currentPeriodEnd = (subscription as any).current_period_end ? Number((subscription as any).current_period_end) * 1000 : null;

        settings.stripeSubscriptionId = subscription.id;
        settings.subscriptionStatus = status;
        if (currentPeriodEnd) settings.subscriptionCurrentPeriodEnd = currentPeriodEnd;
        await settings.save();

        console.log("✅ Updated subscription status:", {
          subscriptionId: subscription.id,
          status,
          currentPeriodEnd
        });

        return res.json({
          subscriptionStatus: status,
          subscriptionCurrentPeriodEnd: currentPeriodEnd,
          updated: true
        });
      } catch (err: any) {
        console.error("Error retrieving subscription:", err?.message || err);
        // If it fails, try to find subscription from customer
      }
    }

    // If we have a customer ID but no valid subscription ID, try to find the subscription
    if (settings.stripeCustomerId && !subscription) {
      try {
        console.log("Searching for subscription by customer ID:", settings.stripeCustomerId);
        const subscriptions = await stripe.subscriptions.list({
          customer: settings.stripeCustomerId,
          limit: 10,
          status: "all"
        });

        // Find the most recent active subscription, or the most recent one
        const activeSub = subscriptions.data.find(sub => sub.status === "active");
        const latestSub = subscriptions.data[0] || null;

        subscription = activeSub || latestSub;

        if (subscription) {
          const status = subscription.status;
          const currentPeriodEnd = (subscription as any).current_period_end ? Number((subscription as any).current_period_end) * 1000 : null;

          settings.stripeSubscriptionId = subscription.id;
          settings.subscriptionStatus = status;
          if (currentPeriodEnd) settings.subscriptionCurrentPeriodEnd = currentPeriodEnd;
          await settings.save();

          console.log("✅ Found and updated subscription:", {
            subscriptionId: subscription.id,
            status,
            currentPeriodEnd
          });

          return res.json({
            subscriptionStatus: status,
            subscriptionCurrentPeriodEnd: currentPeriodEnd,
            updated: true
          });
        }
      } catch (err: any) {
        console.error("Error finding subscription:", err?.message || err);
      }
    }

    // Return current status
    return res.json({
      subscriptionStatus: settings.subscriptionStatus,
      subscriptionCurrentPeriodEnd: settings.subscriptionCurrentPeriodEnd,
      updated: false
    });
  } catch (error: any) {
    console.error("Error checking subscription status:", error?.message || error);
    return res.status(500).json({ error: "unable to check subscription status" });
  }
};

// Create a Customer Portal session (optional)
export const createPortalSession: RequestHandler = async (req, res) => {
  try {
    const salonId = (req.params && typeof req.params.salonId === "string" && req.params.salonId) || "main";
    const settings = await Settings.findOne({ salonId });
    if (!settings || !settings.stripeCustomerId) return res.status(404).json({ error: "customer not found" });

    if (!process.env.STRIPE_PORTAL_RETURN_URL) return res.status(500).json({ error: "STRIPE_PORTAL_RETURN_URL not configured" });

    const session = await stripe.billingPortal.sessions.create({
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
    event = stripe.webhooks.constructEvent((req as any).rawBody || req.body, sig, webhookSecret);
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
      // Try to get salonId from session metadata first, then from subscription metadata
      let salonId = session.metadata?.salonId;
      
      // If not in session metadata, try to get it from the subscription
      if (!salonId && subscriptionId) {
        try {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          salonId = subscription.metadata?.salonId;
        } catch (err) {
          console.error('Error retrieving subscription:', err);
        }
      }
      
      salonId = salonId ?? "main";
      
      console.log('📦 Webhook: checkout.session.completed', {
        customerId,
        subscriptionId,
        salonId,
        sessionMetadata: session.metadata
      });

      const settings = await Settings.findOne({ salonId });
      if (settings) {
        console.log('✅ Found settings for salonId:', salonId);
        settings.stripeCustomerId = customerId ?? settings.stripeCustomerId;
        
        // Ensure we have a subscription ID (not an invoice ID)
        let finalSubscriptionId = subscriptionId;
        if (subscriptionId && subscriptionId.startsWith("in_")) {
          // If it's an invoice ID, retrieve the invoice to get the subscription ID
          try {
            const invoice = await stripe.invoices.retrieve(subscriptionId);
            finalSubscriptionId = invoice.subscription as string | null;
            console.log('📄 Converted invoice ID to subscription ID:', finalSubscriptionId);
          } catch (err) {
            console.error('Error retrieving invoice from webhook:', err);
          }
        }
        
        // If we have a subscription ID, also get the current period end
        let currentPeriodEnd: number | null = null;
        if (finalSubscriptionId && finalSubscriptionId.startsWith("sub_")) {
          try {
            const subscription = await stripe.subscriptions.retrieve(finalSubscriptionId);
            currentPeriodEnd = subscription.current_period_end ? Number(subscription.current_period_end) * 1000 : null;
            settings.subscriptionStatus = subscription.status || "active";
            if (currentPeriodEnd) settings.subscriptionCurrentPeriodEnd = currentPeriodEnd;
          } catch (err) {
            console.error('Error retrieving subscription details:', err);
            settings.subscriptionStatus = "active";
          }
        } else {
          settings.subscriptionStatus = "active";
        }
        
        if (finalSubscriptionId) {
          settings.stripeSubscriptionId = finalSubscriptionId;
        }
        
        await settings.save();
        console.log('💾 Updated settings with subscription info:', {
          stripeCustomerId: settings.stripeCustomerId,
          stripeSubscriptionId: settings.stripeSubscriptionId,
          subscriptionStatus: settings.subscriptionStatus,
          subscriptionCurrentPeriodEnd: settings.subscriptionCurrentPeriodEnd
        });
      } else {
        console.error('❌ No settings found for salonId:', salonId);
      }
    }

    if (type === "invoice.payment_succeeded") {
      const invoice = data as any;
      const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      
      console.log('💰 Webhook: invoice.payment_succeeded', {
        invoiceId: invoice.id,
        subscriptionId,
        customerId
      });

      // Try to locate settings by stripeCustomerId or by subscription metadata
      let settings = null;
      if (customerId) {
        settings = await Settings.findOne({ stripeCustomerId: customerId });
      }
      
      // If we have a subscription ID, retrieve it to get the actual status
      if (settings && subscriptionId) {
        try {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const status = subscription.status;
          const currentPeriodEnd = (subscription as any).current_period_end ? Number((subscription as any).current_period_end) * 1000 : null;

          settings.stripeSubscriptionId = subscription.id;
          settings.subscriptionStatus = status; // Should be "active" after successful payment
          if (currentPeriodEnd) settings.subscriptionCurrentPeriodEnd = currentPeriodEnd;
          await settings.save();
          
          console.log('✅ Updated subscription after invoice payment:', {
            subscriptionId: subscription.id,
            status,
            currentPeriodEnd
          });
        } catch (err: any) {
          console.error('Error retrieving subscription in invoice.payment_succeeded:', err?.message || err);
          // Fallback: set status to active if we can't retrieve subscription
          settings.subscriptionStatus = "active";
          await settings.save();
        }
      } else if (settings) {
        // If we have settings but no subscription ID, try to find it
        console.log('⚠️ Invoice payment succeeded but no subscription ID found, searching by customer');
        try {
          const subscriptions = await stripe.subscriptions.list({
            customer: customerId as string,
            limit: 1,
            status: "active"
          });
          
          if (subscriptions.data.length > 0) {
            const subscription = subscriptions.data[0];
            const currentPeriodEnd = (subscription as any).current_period_end ? Number((subscription as any).current_period_end) * 1000 : null;
            settings.stripeSubscriptionId = subscription.id;
            settings.subscriptionStatus = subscription.status;
            if (currentPeriodEnd) settings.subscriptionCurrentPeriodEnd = currentPeriodEnd;
            await settings.save();
          }
        } catch (err: any) {
          console.error('Error finding subscription:', err?.message || err);
        }
      }
    }

    if (type === "customer.subscription.updated") {
      const sub = data as any;
      const subscriptionId = sub.id;
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
      const status = sub.status;
      const currentPeriodEnd = sub.current_period_end ? Number(sub.current_period_end) * 1000 : null;

      console.log('🔄 Webhook: customer.subscription.updated', {
        subscriptionId,
        customerId,
        status
      });

      // Try to locate settings by stripeCustomerId or by metadata
      let settings = null;
      if (customerId) settings = await Settings.findOne({ stripeCustomerId: customerId });
      if (!settings && sub.metadata && sub.metadata.salonId) {
        settings = await Settings.findOne({ salonId: sub.metadata.salonId });
      }
      
      if (settings) {
        settings.stripeSubscriptionId = subscriptionId ?? settings.stripeSubscriptionId;
        settings.subscriptionStatus = status ?? settings.subscriptionStatus;
        if (currentPeriodEnd) settings.subscriptionCurrentPeriodEnd = currentPeriodEnd;
        await settings.save();
        
        console.log('✅ Updated subscription status:', {
          subscriptionId,
          status,
          currentPeriodEnd
        });
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
