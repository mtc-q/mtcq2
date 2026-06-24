/* ═══════════════════════════════════════════════════════════
   js/stripe-billing.js
   Stripe Checkout integration for subscription plans
   ═══════════════════════════════════════════════════════════ */

// ── YOUR Stripe Configuration ────────────────────────────
// Replace with your actual Stripe publishable key and Price IDs.
// Get your key at: https://dashboard.stripe.com/apikeys
// Create products at: https://dashboard.stripe.com/products

const STRIPE_PUBLISHABLE_KEY = "pk_live_YOUR_STRIPE_PUBLISHABLE_KEY";
// For testing, use: "pk_test_YOUR_TEST_KEY"

// Stripe Price IDs for each plan.
// Create these in your Stripe Dashboard → Products → Add product
// Set each as a recurring subscription with the prices below.
export const STRIPE_PRICES = {
  starter_monthly: "price_YOUR_STARTER_MONTHLY_PRICE_ID",  // $2/month
  starter_annual:  "price_YOUR_STARTER_ANNUAL_PRICE_ID",   // $20/year
  pro_monthly:     "price_YOUR_PRO_MONTHLY_PRICE_ID",      // $5/month
  pro_annual:      "price_YOUR_PRO_ANNUAL_PRICE_ID",       // $50/year
};

// Your domain — used for Stripe success/cancel redirect URLs
const DOMAIN = window.location.origin;

// ── Load Stripe.js ───────────────────────────────────────
let _stripe = null;

async function getStripe() {
  if (_stripe) return _stripe;
  // Load Stripe.js dynamically
  await loadScript("https://js.stripe.com/v3/");
  _stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
  return _stripe;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s   = document.createElement("script");
    s.src     = src;
    s.onload  = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ═══════════════════════════════════════════════════════════
// CHECKOUT SESSION
// ═══════════════════════════════════════════════════════════

/**
 * Redirect the user to Stripe Checkout for a subscription.
 *
 * This calls your Firebase Cloud Function "createCheckoutSession"
 * which creates the session server-side (required by Stripe).
 *
 * @param {string} priceId   - Stripe Price ID
 * @param {string} uid       - Firebase user UID
 * @param {string} email     - User email
 */
export async function redirectToCheckout(priceId, uid, email) {
  const stripe = await getStripe();

  try {
    // Call your Cloud Function to create a Checkout Session
    const response = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        priceId,
        uid,
        email,
        successUrl: `${DOMAIN}/dashboard?upgrade=success`,
        cancelUrl:  `${DOMAIN}/pricing`
      })
    });

    if (!response.ok) throw new Error("Failed to create checkout session.");

    const { sessionId } = await response.json();

    // Redirect to Stripe Checkout
    const { error } = await stripe.redirectToCheckout({ sessionId });
    if (error) throw new Error(error.message);

  } catch (err) {
    console.error("Stripe checkout error:", err);
    throw err;
  }
}

/**
 * Open the Stripe Customer Portal for billing management.
 * Allows users to cancel, change plan, update payment method.
 *
 * @param {string} uid - Firebase user UID
 */
export async function openCustomerPortal(uid) {
  try {
    const response = await fetch("/api/create-portal-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid,
        returnUrl: `${DOMAIN}/dashboard/settings`
      })
    });

    if (!response.ok) throw new Error("Failed to open billing portal.");

    const { url } = await response.json();
    window.location.href = url;

  } catch (err) {
    console.error("Customer portal error:", err);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════
// PLAN DISPLAY DATA
// (Used to render pricing cards across the site)
// ═══════════════════════════════════════════════════════════

export const PLANS = [
  {
    id:       "free",
    name:     "Free",
    price:    0,
    period:   "forever",
    desc:     "Your first link page, up and running in minutes.",
    badge:    null,
    featured: false,
    cta:      "Get started free",
    priceId:  null,
    features: [
      "Up to 10 links",
      "Link thumbnails & titles",
      "QR code download",
      "yourplatform.com/username",
      "Basic page view counter",
      "One-click Linktree import",
      "Default background themes"
    ],
    limits: {
      links:    10,
      branding: true
    }
  },
  {
    id:       "starter",
    name:     "Starter",
    price:    2,
    period:   "per month",
    desc:     "The essentials for creators who want to look professional.",
    badge:    null,
    featured: false,
    cta:      "Start for $2/mo",
    priceId:  "starter_monthly",
    features: [
      "Up to 20 links",
      "Custom background color & image",
      "Custom text color",
      "Per-link click analytics (7 days)",
      "Email capture widget",
      "Video embed (YouTube, Vimeo)",
      "Music player (Spotify, SoundCloud)",
      "Link health checker",
      "Link scheduling (start & end dates)",
      "Pre-made theme presets"
    ],
    limits: {
      links:    20,
      branding: true
    }
  },
  {
    id:       "pro",
    name:     "Pro",
    price:    5,
    period:   "per month",
    desc:     "Everything you need to run your link page like a business.",
    badge:    "Most popular",
    featured: true,
    cta:      "Go Pro — $5/mo",
    priceId:  "pro_monthly",
    features: [
      "Unlimited links",
      "No platform branding",
      "Full analytics — geo, device, referrer (90 days)",
      "Analytics CSV export",
      "Google Analytics 4 integration",
      "Meta Pixel integration",
      "Password-protect your page",
      "Page version history",
      "Weekly analytics email digest",
      "Events list widget",
      "Countdown timer widget",
      "Testimonials widget",
      "Contact form widget",
      "Custom HTML embed block",
      "REST API access",
      "Two-factor authentication"
    ],
    limits: {
      links:    Infinity,
      branding: false
    }
  }
];

// ═══════════════════════════════════════════════════════════
// PRICING UI RENDERER
// Renders plan cards into a container element.
// ═══════════════════════════════════════════════════════════

/**
 * Render pricing cards into a container.
 * @param {string} containerId    - ID of the container element
 * @param {string} currentPlan    - The user's current plan (or null)
 * @param {string} uid            - Firebase user UID (or null if not logged in)
 * @param {string} userEmail      - User email (or null)
 */
export function renderPricingCards(containerId, currentPlan = null, uid = null, userEmail = null) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";
  container.className = "pricing-grid";

  PLANS.forEach(plan => {
    const isCurrent = currentPlan === plan.id;
    const card      = document.createElement("div");

    card.className = `plan-card${plan.featured ? " plan-card--featured" : ""}`;

    let ctaHtml;
    if (isCurrent) {
      ctaHtml = `<button class="btn btn--outline btn--full" disabled>Current plan</button>`;
    } else if (!plan.priceId) {
      ctaHtml = uid
        ? `<button class="btn btn--outline btn--full" disabled>Your current plan</button>`
        : `<a href="/signup" class="btn btn--${plan.featured ? "primary" : "outline"} btn--full">${plan.cta}</a>`;
    } else {
      ctaHtml = `
        <button
          class="btn btn--${plan.featured ? "primary" : "outline"} btn--full"
          onclick="handlePlanSelect('${plan.priceId}', '${plan.id}', '${uid || ""}', '${userEmail || ""}')"
        >
          ${plan.cta}
        </button>
      `;
    }

    card.innerHTML = `
      ${plan.badge ? `<div class="plan-card__badge">${plan.badge}</div>` : ""}
      <div class="plan-card__name">${plan.name}</div>
      <div class="plan-card__price">
        <span class="plan-card__amount">${plan.price === 0 ? "Free" : `$${plan.price}`}</span>
        ${plan.price > 0 ? `<span class="plan-card__period">${plan.period}</span>` : ""}
      </div>
      <p class="plan-card__desc">${plan.desc}</p>
      <div class="plan-card__divider"></div>
      <ul class="plan-card__features">
        ${plan.features.map(f => `
          <li class="plan-card__feature">
            <span class="plan-card__feature-icon">✓</span>
            <span>${f}</span>
          </li>
        `).join("")}
      </ul>
      ${ctaHtml}
    `;

    container.appendChild(card);
  });
}

/**
 * Handle plan selection button click.
 * Called inline from rendered pricing cards.
 */
window.handlePlanSelect = async function(priceId, planName, uid, email) {
  if (!uid) {
    // Not logged in — redirect to signup with plan intent
    window.location.href = `/signup?plan=${planName}`;
    return;
  }

  const btn = event.currentTarget;
  btn.disabled    = true;
  btn.textContent = "Redirecting to checkout...";

  try {
    const resolvedPriceId = STRIPE_PRICES[priceId];
    await redirectToCheckout(resolvedPriceId, uid, email);
  } catch (err) {
    btn.disabled    = false;
    btn.textContent = "Try again";
    window.showToast("Checkout failed. Please try again.", "error");
  }
};

// ═══════════════════════════════════════════════════════════
// UPGRADE CHECK HELPERS
// ═══════════════════════════════════════════════════════════

/**
 * Show an upgrade prompt when a user hits a plan limit.
 * @param {string} featureName - Human-readable feature name
 * @param {string} requiredPlan - "starter" or "pro"
 */
export function showUpgradePrompt(featureName, requiredPlan) {
  const plan     = PLANS.find(p => p.id === requiredPlan);
  const overlay  = document.createElement("div");
  overlay.className = "modal-overlay open";
  overlay.innerHTML = `
    <div class="modal" style="max-width:420px">
      <div class="modal-header">
        <span class="modal-title">Upgrade to ${plan.name}</span>
        <button class="modal-close icon-btn" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div style="text-align:center; padding: 1rem 0 1.5rem;">
        <div style="font-size:3rem; margin-bottom:1rem;">⚡</div>
        <p style="color:var(--text-2); margin-bottom:1.5rem; font-size:0.9375rem; line-height:1.6;">
          <strong style="color:var(--text-1)">${featureName}</strong> is available on the
          <strong style="color:var(--brand-mid)">${plan.name}</strong> plan for just
          <strong style="color:var(--text-1)">$${plan.price}/month</strong>.
        </p>
        <button
          class="btn btn--primary btn--full"
          onclick="handlePlanSelect('${plan.id}_monthly', '${plan.id}', window.__currentUser?.uid, window.__currentUser?.email)"
        >
          Upgrade to ${plan.name} — $${plan.price}/mo
        </button>
        <button class="btn btn--ghost btn--full" style="margin-top:0.5rem"
          onclick="this.closest('.modal-overlay').remove()">
          Maybe later
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

export default {
  redirectToCheckout,
  openCustomerPortal,
  renderPricingCards,
  showUpgradePrompt,
  PLANS,
  STRIPE_PRICES
};
