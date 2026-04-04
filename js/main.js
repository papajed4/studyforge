// ============================================
// MAIN.JS - Shared Functions (Pricing, Modals, etc)
// ============================================

// Global variables
let userCountry = "US";
let billingMode = "monthly";

const pricingTable = {
    NG: { symbol: "₦", monthly: 3500 },      // Nigeria - Naira
    US: { symbol: "$", monthly: 8.99 },       // USA - Dollar
    GB: { symbol: "£", monthly: 7.99 },       // UK - Pound
    CA: { symbol: "C$", monthly: 11.99 },     // Canada - Canadian Dollar
    DE: { symbol: "€", monthly: 8 },           // Germany - Euro
    FR: { symbol: "€", monthly: 8 },           // France - Euro
    IT: { symbol: "€", monthly: 8 },           // Italy - Euro
    ES: { symbol: "€", monthly: 8 },           // Spain - Euro
    NL: { symbol: "€", monthly: 8 },           // Netherlands - Euro
    AU: { symbol: "A$", monthly: 12.99 },      // Australia - Australian Dollar
    JP: { symbol: "¥", monthly: 1200 },        // Japan - Yen
    IN: { symbol: "₹", monthly: 699 }          // India - Rupee
};

const euroCountries = [
    "FR", "DE", "ES", "IT", "NL", "BE", "PT", "IE", "AT", "FI",
    "GR", "LU", "LV", "LT", "EE", "CY", "MT", "SK", "SI"
];

const euroPricing = { symbol: "€", monthly: 8 };

// ============================================
// COUNTRY DETECTION
// ============================================

async function detectCountry() {
    console.log("🔍 Detecting country...");

    // Check localStorage first
    const cachedCountry = localStorage.getItem('userCountry');
    const cacheTime = localStorage.getItem('userCountryTime');

    // Use cache if less than 7 days old
    if (cachedCountry && cacheTime) {
        const daysOld = (Date.now() - parseInt(cacheTime)) / (1000 * 60 * 60 * 24);
        if (daysOld < 7) {
            userCountry = cachedCountry;
            console.log("🌍 Using cached country:", userCountry);
            updatePricingUI();
            updateModalPricing();
            return;
        }
    }

    // Try to detect country using multiple methods
    let detectedCountry = null;

    // Method 1: Check timezone
    try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        console.log("🕐 Timezone:", timezone);

        if (timezone.includes('Lagos') || timezone.includes('Africa')) {
            detectedCountry = 'NG';
        } else if (timezone.includes('New_York') || timezone.includes('Chicago') || timezone.includes('Los_Angeles') || timezone.includes('Denver')) {
            detectedCountry = 'US';
        } else if (timezone.includes('London')) {
            detectedCountry = 'GB';
        } else if (timezone.includes('Berlin') || timezone.includes('Frankfurt')) {
            detectedCountry = 'DE';
        } else if (timezone.includes('Paris')) {
            detectedCountry = 'FR';
        } else if (timezone.includes('Rome') || timezone.includes('Milan')) {
            detectedCountry = 'IT';
        } else if (timezone.includes('Madrid')) {
            detectedCountry = 'ES';
        } else if (timezone.includes('Amsterdam')) {
            detectedCountry = 'NL';
        } else if (timezone.includes('Toronto') || timezone.includes('Vancouver')) {
            detectedCountry = 'CA';
        } else if (timezone.includes('Sydney') || timezone.includes('Melbourne')) {
            detectedCountry = 'AU';
        } else if (timezone.includes('Tokyo')) {
            detectedCountry = 'JP';
        } else if (timezone.includes('Mumbai') || timezone.includes('Kolkata')) {
            detectedCountry = 'IN';
        }
    } catch (e) { }

    // Method 2: Check language
    if (!detectedCountry) {
        const lang = navigator.language || '';
        console.log("🌐 Language:", lang);

        if (lang.includes('NG') || lang.includes('en-NG')) {
            detectedCountry = 'NG';
        } else if (lang.includes('US') || lang.includes('en-US')) {
            detectedCountry = 'US';
        } else if (lang.includes('GB') || lang.includes('en-GB')) {
            detectedCountry = 'GB';
        } else if (lang.includes('DE') || lang.includes('de-DE')) {
            detectedCountry = 'DE';
        } else if (lang.includes('FR') || lang.includes('fr-FR')) {
            detectedCountry = 'FR';
        } else if (lang.includes('IT') || lang.includes('it-IT')) {
            detectedCountry = 'IT';
        } else if (lang.includes('ES') || lang.includes('es-ES')) {
            detectedCountry = 'ES';
        } else if (lang.includes('NL') || lang.includes('nl-NL')) {
            detectedCountry = 'NL';
        } else if (lang.includes('CA') || lang.includes('en-CA') || lang.includes('fr-CA')) {
            detectedCountry = 'CA';
        } else if (lang.includes('AU') || lang.includes('en-AU')) {
            detectedCountry = 'AU';
        } else if (lang.includes('JP') || lang.includes('ja-JP')) {
            detectedCountry = 'JP';
        } else if (lang.includes('IN') || lang.includes('hi-IN')) {
            detectedCountry = 'IN';
        }
    }

    // Default to US if nothing else worked
    userCountry = detectedCountry || 'US';

    // Save to localStorage with timestamp
    localStorage.setItem('userCountry', userCountry);
    localStorage.setItem('userCountryTime', Date.now().toString());

    console.log("🌍 Country set to:", userCountry);

    // Update pricing displays
    updatePricingUI();
    updateModalPricing();
}

// ============================================
// PRICING FUNCTIONS (Index Page)
// ============================================
function toggleBilling() {
    const toggle = document.getElementById("billingToggle");
    const circle = document.getElementById("toggleCircle");
    const monthlyLabel = document.getElementById("monthlyLabel");
    const yearlyLabel = document.getElementById("yearlyLabel");

    if (!toggle || !circle) return;

    if (billingMode === "monthly") {
        billingMode = "yearly";
        circle.classList.add("translate-x-5");
        toggle.classList.add("bg-indigo-600");
        toggle.classList.remove("bg-slate-300");

        if (monthlyLabel) {
            monthlyLabel.classList.remove("text-slate-900");
            monthlyLabel.classList.add("text-slate-500");
        }
        if (yearlyLabel) {
            yearlyLabel.classList.remove("text-slate-500");
            yearlyLabel.classList.add("text-slate-900");
        }
    } else {
        billingMode = "monthly";
        circle.classList.remove("translate-x-5");
        toggle.classList.remove("bg-indigo-600");
        toggle.classList.add("bg-slate-300");

        if (yearlyLabel) {
            yearlyLabel.classList.remove("text-slate-900");
            yearlyLabel.classList.add("text-slate-500");
        }
        if (monthlyLabel) {
            monthlyLabel.classList.remove("text-slate-500");
            monthlyLabel.classList.add("text-slate-900");
        }
    }

    updatePricingUI();
}

function updatePricingUI() {
    const priceEl = document.getElementById("proPrice");
    const perDayEl = document.getElementById("perDayPrice");
    const trialPriceEl = document.getElementById("trialPriceValue");
    const trialPeriodEl = document.getElementById("trialPeriodText");
    const trialButton = document.getElementById("proTrialButton");

    if (!priceEl) return;

    let pricing = pricingTable[userCountry] ||
        (euroCountries.includes(userCountry) ? euroPricing : pricingTable["US"]);

    const monthlyPrice = pricing.monthly;
    const symbol = pricing.symbol;

    if (billingMode === "monthly") {
        // Monthly pricing
        priceEl.innerText = `${symbol}${monthlyPrice}`;
        if (perDayEl) perDayEl.innerText = "Billed monthly";

        // Update trial button and text
        if (trialButton) trialButton.innerHTML = "Start 3-Day Free Trial";
        if (trialButton) trialButton.setAttribute("onclick", "handleUpgradeClick('monthly')");
        if (trialPriceEl) trialPriceEl.innerText = `${symbol}${monthlyPrice}`;
        if (trialPeriodEl) trialPeriodEl.innerText = "month";

    } else {
        // Yearly pricing
        const yearlyPrice = (monthlyPrice * 12 * 0.8).toFixed(2);
        const perDay = (yearlyPrice / 365).toFixed(2);
        priceEl.innerText = `${symbol}${yearlyPrice}`;
        if (perDayEl) perDayEl.innerText = `≈ ${symbol}${perDay} per day (billed yearly)`;

        // Update trial button and text for yearly
        if (trialButton) trialButton.innerHTML = "Start 7-Day Free Trial";
        if (trialButton) trialButton.setAttribute("onclick", "handleUpgradeClick('yearly')");
        if (trialPriceEl) trialPriceEl.innerText = `${symbol}${yearlyPrice}`;
        if (trialPeriodEl) trialPeriodEl.innerText = "year";
    }
}

// ============================================
// UPGRADE MODAL FUNCTIONS (Dashboard)
// ============================================
window.toggleUpgradeModal = function () {
    const modal = document.getElementById('upgradeModal');
    if (modal) {
        updateModalPricing();
        modal.classList.toggle('hidden');

        if (window.gsap && !modal.classList.contains('hidden')) {
            gsap.fromTo(modal,
                { opacity: 0 },
                { opacity: 1, duration: 0.3 }
            );
            gsap.fromTo(modal.firstElementChild,
                { scale: 0.95, y: 10, opacity: 0 },
                { scale: 1, y: 0, opacity: 1, duration: 0.4, ease: "back.out(1.2)" }
            );
        }
    }
};

function updateModalPricing() {
    const priceEl = document.getElementById('modalPrice');
    const billingPeriodEl = document.getElementById('modalBillingPeriod');
    const perDayEl = document.getElementById('modalPerDay');

    if (!priceEl) return;

    let pricing = pricingTable[userCountry] ||
        (euroCountries.includes(userCountry) ? euroPricing : pricingTable["US"]);

    const monthlyPrice = pricing.monthly;
    const symbol = pricing.symbol;

    const circle = document.getElementById('modalToggleCircle');
    const isYearly = circle?.classList.contains('translate-x-5');

    if (!isYearly) {
        priceEl.innerText = `${symbol}${monthlyPrice}`;
        billingPeriodEl.innerText = 'per month';
        const perDay = (monthlyPrice / 30).toFixed(2);
        if (perDayEl) perDayEl.innerText = `≈ ${symbol}${perDay} per day`;
    } else {
        const yearlyPrice = (monthlyPrice * 12 * 0.8).toFixed(2);
        priceEl.innerText = `${symbol}${yearlyPrice}`;
        billingPeriodEl.innerText = 'per year';
        const perDay = (yearlyPrice / 365).toFixed(2);
        if (perDayEl) perDayEl.innerText = `≈ ${symbol}${perDay} per day`;
    }
}

window.toggleModalBilling = function () {
    const circle = document.getElementById('modalToggleCircle');
    const monthlyLabel = document.getElementById('modalMonthlyLabel');
    const yearlyLabel = document.getElementById('modalYearlyLabel');

    if (circle?.classList.contains('translate-x-5')) {
        circle.classList.remove('translate-x-5');
        circle.classList.add('translate-x-1');
        billingMode = 'monthly';

        if (monthlyLabel) {
            monthlyLabel.classList.remove('text-slate-500');
            monthlyLabel.classList.add('text-slate-900');
        }
        if (yearlyLabel) {
            yearlyLabel.classList.remove('text-slate-900');
            yearlyLabel.classList.add('text-slate-500');
        }
    } else {
        circle?.classList.add('translate-x-5');
        circle?.classList.remove('translate-x-1');
        billingMode = 'yearly';

        if (yearlyLabel) {
            yearlyLabel.classList.remove('text-slate-500');
            yearlyLabel.classList.add('text-slate-900');
        }
        if (monthlyLabel) {
            monthlyLabel.classList.remove('text-slate-900');
            monthlyLabel.classList.add('text-slate-500');
        }
    }

    updateModalPricing();
};

// ============================================
// UPGRADE CLICK WITH PLAN TYPE (FIXED)
// ============================================
window.handleUpgradeClick = async function (plan = 'monthly') {
    // Get the upgrade button that was clicked
    const upgradeBtn = event?.target?.closest('button') || document.querySelector('.upgrade-btn');
    const originalText = upgradeBtn?.innerText || 'Upgrade to Pro';

    // Show loading state
    if (upgradeBtn) {
        upgradeBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Preparing payment...';
        upgradeBtn.disabled = true;
        upgradeBtn.classList.add('opacity-75', 'cursor-not-allowed');
    }

    const token = await window.getAuthToken?.();
    if (!token) {
        window.showToast?.("Please sign in first.");
        if (upgradeBtn) {
            upgradeBtn.innerHTML = originalText;
            upgradeBtn.disabled = false;
            upgradeBtn.classList.remove('opacity-75', 'cursor-not-allowed');
        }
        return;
    }

    try {
        // Check if user already has Pro
        const response = await fetch("/api/account", {
            headers: { "Authorization": `Bearer ${token}` }
        });

        const accountData = await response.json();

        if (accountData.success && accountData.plan === "pro") {
            const expiryDate = accountData.expires_at ? new Date(accountData.expires_at).toLocaleDateString() : 'N/A';
            window.showToast?.(`✅ You are already on Pro plan! Expires: ${expiryDate}`, "success");
            if (upgradeBtn) {
                upgradeBtn.innerHTML = originalText;
                upgradeBtn.disabled = false;
                upgradeBtn.classList.remove('opacity-75', 'cursor-not-allowed');
            }
            return;
        }

        // Get user's country for pricing
        if (!userCountry) {
            await detectCountry();
        }

        // Store the plan type for trial length
        localStorage.setItem("billingMode", plan);

        // Initialize payment with plan type
        const initResponse = await fetch("/api/initialize-payment", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                country: userCountry,
                billingMode: plan  // 'monthly' or 'yearly'
            })
        });

        const data = await initResponse.json();

        if (!data.success) {
            window.showToast?.("Payment failed to start: " + (data.error || "Unknown error"));
            if (upgradeBtn) {
                upgradeBtn.innerHTML = originalText;
                upgradeBtn.disabled = false;
                upgradeBtn.classList.remove('opacity-75', 'cursor-not-allowed');
            }
            return;
        }

        localStorage.setItem("paymentProcessor", data.processor);

        // Redirect to payment page
        window.location.href = data.authorization_url;

    } catch (err) {
        console.error("❌ Upgrade error:", err);
        window.showToast?.("Payment error: " + err.message);
        if (upgradeBtn) {
            upgradeBtn.innerHTML = originalText;
            upgradeBtn.disabled = false;
            upgradeBtn.classList.remove('opacity-75', 'cursor-not-allowed');
        }
    }
};

// ============================================
// MODAL UPGRADE WITH LOADING STATE
// ============================================
window.handleModalUpgrade = async function () {
    // Get the modal upgrade button
    const modalBtn = document.querySelector('#upgradeModal .upgrade-btn');
    const originalText = modalBtn.innerText;

    // Show loading state
    modalBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Processing...';
    modalBtn.disabled = true;
    modalBtn.classList.add('opacity-75', 'cursor-not-allowed');

    const token = await window.getAuthToken?.();
    if (!token) {
        window.showToast?.("Please sign in first.");
        window.toggleUpgradeModal?.();

        // Restore button (modal will close anyway)
        modalBtn.innerHTML = originalText;
        modalBtn.disabled = false;
        modalBtn.classList.remove('opacity-75', 'cursor-not-allowed');
        return;
    }

    try {
        const response = await fetch("/api/account", {
            headers: { "Authorization": `Bearer ${token}` }
        });

        const accountData = await response.json();

        if (accountData.success && accountData.plan === "pro") {
            const expiryDate = accountData.expires_at ? new Date(accountData.expires_at).toLocaleDateString() : 'N/A';
            window.showToast?.(`✅ You are already on Pro plan! Expires: ${expiryDate}`, "success");
            window.toggleUpgradeModal?.();

            // Restore button
            modalBtn.innerHTML = originalText;
            modalBtn.disabled = false;
            modalBtn.classList.remove('opacity-75', 'cursor-not-allowed');
            return;
        }

        window.toggleUpgradeModal?.();
        window.handleUpgradeClick();

    } catch (err) {
        window.showToast?.("Error checking plan status: " + err.message);
        window.toggleUpgradeModal?.();

        // Restore button
        modalBtn.innerHTML = originalText;
        modalBtn.disabled = false;
        modalBtn.classList.remove('opacity-75', 'cursor-not-allowed');
    }
};

// ============================================
// USAGE FUNCTIONS - WITH WARNING BAR
// ============================================
window.loadUsage = async function () {
    const token = await window.getAuthToken?.();
    if (!token) return;

    try {
        // First check if user is Pro
        const accountResponse = await fetch("/api/account", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const accountData = await accountResponse.json();

        // If user is Pro, hide the usage badge and warning bar
        if (accountData.success && accountData.plan === "pro") {
            const badge = document.getElementById("usageBadge");
            const warningBar = document.getElementById("usageWarningBar");
            if (badge) badge.classList.add("hidden");
            if (warningBar) warningBar.classList.add("hidden");

            // Update account section to show Unlimited
            const usageDisplay = document.getElementById("accountUsageDisplay");
            if (usageDisplay) usageDisplay.innerHTML = "♾️ Unlimited";

            return;
        }

        // Only fetch usage for Free users
        const response = await fetch('/api/usage', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) return;

        const data = await response.json();

        if (data.success) {
            const badge = document.getElementById("usageBadge");
            const warningBar = document.getElementById("usageWarningBar");
            const remaining = 5 - data.used;
            const remainingSpan = document.getElementById("usageRemaining");

            if (badge) {
                badge.classList.remove("hidden");
                badge.innerText = `${data.used}/5 used today`;
                if (data.used >= 5) {
                    badge.classList.add("text-red-600");
                } else {
                    badge.classList.remove("text-red-600");
                }
            }

            // Update account section with current usage
            const usageDisplay = document.getElementById("accountUsageDisplay");
            if (usageDisplay) usageDisplay.innerHTML = `${data.used}/5 used today`;

            // Update warning bar
            if (warningBar && remainingSpan) {
                remainingSpan.innerText = remaining;

                if (remaining <= 2) {
                    warningBar.classList.remove("hidden");

                    if (remaining === 0) {
                        warningBar.classList.remove("bg-amber-50", "border-amber-500");
                        warningBar.classList.add("bg-red-50", "border-red-500");
                        const icon = warningBar.querySelector('i');
                        if (icon) icon.classList.remove('fa-gauge-high', 'text-amber-600');
                        if (icon) icon.classList.add('fa-circle-exclamation', 'text-red-600');
                    } else if (remaining === 1) {
                        warningBar.classList.remove("bg-amber-50", "border-amber-500");
                        warningBar.classList.add("bg-orange-50", "border-orange-500");
                        const icon = warningBar.querySelector('i');
                        if (icon) icon.classList.remove('fa-gauge-high', 'text-amber-600');
                        if (icon) icon.classList.add('fa-hourglass-half', 'text-orange-600');
                    } else {
                        warningBar.classList.remove("bg-red-50", "border-red-500", "bg-orange-50", "border-orange-500");
                        warningBar.classList.add("bg-amber-50", "border-amber-500");
                        const icon = warningBar.querySelector('i');
                        if (icon) icon.classList.remove('fa-circle-exclamation', 'text-red-600', 'fa-hourglass-half', 'text-orange-600');
                        if (icon) icon.classList.add('fa-gauge-high', 'text-amber-600');
                    }
                } else {
                    warningBar.classList.add("hidden");
                }
            }
        }
    } catch (err) {
        console.error("Usage load error:", err);
    }
};

// ============================================
// ACCOUNT FUNCTIONS
// ============================================
window.loadAccountInfo = async function () {
    const token = await window.getAuthToken?.();
    if (!token) return;

    try {
        const response = await fetch("/api/account", {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!response.ok) return;

        const data = await response.json();
        if (!data.success) return;

        // Update all plan displays
        const planElements = [
            'accountPlan',
            'accountPlanDashboard',
            'mobilePlan',
            'upgradeCurrentPlan'
        ];

        planElements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = data.plan === "pro" ? "Pro" : "Free";
        });

        // Update expiry dates
        if (data.expires_at) {
            const date = new Date(data.expires_at).toLocaleDateString();
            ['accountExpiry', 'accountExpiryDashboard'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerText = date;
            });
        }

        // Update account section displays
        const planDisplay = document.getElementById('accountPlanDisplay');
        const expiryDisplay = document.getElementById('accountExpiryDisplay');
        const planBadge = document.getElementById('accountPlanBadge');

        if (planDisplay) planDisplay.innerText = data.plan === "pro" ? "Pro" : "Free";
        if (planBadge) planBadge.innerText = data.plan === "pro" ? "Pro" : "Free";
        if (expiryDisplay) expiryDisplay.innerText = data.expires_at ? new Date(data.expires_at).toLocaleDateString() : "—";

        // Update avatar for Pro users
        if (data.plan === "pro") {
            const avatar = document.getElementById('userAvatar');
            if (avatar) {
                avatar.classList.remove('bg-indigo-600');
                avatar.classList.add('bg-gradient-to-r', 'from-indigo-600', 'to-purple-600');
            }

            const proBadge = document.getElementById('proBadge');
            const proActiveBadge = document.getElementById('proActiveBadge');
            if (proBadge) proBadge.classList.remove('hidden');
            if (proActiveBadge) proActiveBadge.classList.remove('hidden');

            const upgradeMessage = document.querySelector('#accountSection .bg-amber-50');
            if (upgradeMessage) {
                upgradeMessage.classList.add('hidden');
            }

            const warningBar = document.getElementById("usageWarningBar");
            if (warningBar) warningBar.classList.add("hidden");

        } else {
            const proBadge = document.getElementById('proBadge');
            const proActiveBadge = document.getElementById('proActiveBadge');
            if (proBadge) proBadge.classList.add('hidden');
            if (proActiveBadge) proActiveBadge.classList.add('hidden');

            const upgradeMessage = document.querySelector('#accountSection .bg-amber-50');
            if (upgradeMessage) {
                upgradeMessage.classList.remove('hidden');
            }
        }

        // Update upgrade/cancel buttons for Account section
        const upgradeAccountBtn = document.getElementById('upgradeAccountBtn');
        const cancelSubscriptionBtn = document.getElementById('cancelSubscriptionBtn');
        if (upgradeAccountBtn && cancelSubscriptionBtn) {
            if (data.plan === "pro") {
                upgradeAccountBtn.classList.add('hidden');
                cancelSubscriptionBtn.classList.remove('hidden');
            } else {
                upgradeAccountBtn.classList.remove('hidden');
                cancelSubscriptionBtn.classList.add('hidden');
            }
        }

        // Update upgrade button
        const upgradeBtn = document.querySelector('.upgrade-btn');
        if (upgradeBtn) {
            if (data.plan === "pro") {
                upgradeBtn.innerText = "You're on Pro ✓";
                upgradeBtn.disabled = true;
                upgradeBtn.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                upgradeBtn.innerText = "Upgrade to Pro";
                upgradeBtn.disabled = false;
                upgradeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }

    } catch (err) {
        console.log("Account info error:", err);
    }
};

// ============================================
// WELCOME NAME
// ============================================
window.loadWelcomeName = async function () {
    try {
        const supabase = window.supabaseClient;
        if (!supabase) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const name = user.user_metadata?.full_name;
        const welcomeEl = document.getElementById("welcomeText");
        const avatarEl = document.getElementById("userAvatar");

        if (avatarEl && name) {
            const initials = name.split(" ").map(word => word[0]).join("").substring(0, 2).toUpperCase();
            avatarEl.innerText = initials;
        }

        if (!name && welcomeEl) {
            welcomeEl.innerText = "Welcome — tell us your name to personalize your dashboard.";
            const profileSection = document.getElementById("profileNameSection");
            if (profileSection) profileSection.classList.remove("hidden");
            return;
        }

        if (welcomeEl && name) {
            const token = await window.getAuthToken?.();
            let plan = "Free";

            if (token) {
                try {
                    const response = await fetch("/api/account", {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const data = await response.json();
                    if (data.success) plan = data.plan === "pro" ? "Pro" : "Free";
                } catch { }
            }

            welcomeEl.innerHTML = `Scholar ${name} <span class="text-indigo-600 font-semibold">(${plan})</span> — what are we forging today?`;
        }
    } catch (err) {
        console.error("Welcome load error:", err);
    }
};

// ============================================
// SAVE NAME WITH LOADING STATE
// ============================================
window.saveName = async function () {
    const saveBtn = document.querySelector('#profileNameSection button');
    const originalText = saveBtn.innerText;

    saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Saving...';
    saveBtn.disabled = true;
    saveBtn.classList.add('opacity-75', 'cursor-not-allowed');

    const newName = document.getElementById("updateNameInput")?.value;
    if (!newName) {
        window.showToast?.("Please enter a name");
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
        saveBtn.classList.remove('opacity-75', 'cursor-not-allowed');
        return;
    }

    const { error } = await window.supabase.auth.updateUser({
        data: { full_name: newName }
    });

    if (!error) {
        window.showToast?.("Name updated successfully!", "success");
        setTimeout(() => {
            location.reload();
        }, 1500);
    } else {
        window.showToast?.("Error updating name.");
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
        saveBtn.classList.remove('opacity-75', 'cursor-not-allowed');
    }
};

// ============================================
// MOBILE MENU FUNCTIONS
// ============================================
window.toggleMobileMenu = function () {
    const menu = document.getElementById("mobileMenu");
    if (menu) menu.classList.toggle("hidden");
};

window.toggleSidebar = function () {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");

    if (sidebar) sidebar.classList.toggle("-translate-x-full");
    if (overlay) overlay.classList.toggle("hidden");
};

window.toggleAccountDropdown = function () {
    const dropdown = document.getElementById("accountDropdown");
    if (dropdown) dropdown.classList.toggle("hidden");
};

// ============================================
// DASHBOARD REDIRECT
// ============================================
window.handleDashboardClick = async function () {
    try {
        const supabase = window.supabaseClient;

        if (!supabase) {
            window.toggleAuthModal?.();
            window.showToast?.('Please sign in first to access the dashboard');
            return;
        }

        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
            window.location.href = '/dashboard.html';
        } else {
            window.toggleAuthModal?.();
            window.showToast?.('Please sign in first to access the dashboard');
        }
    } catch (error) {
        window.toggleAuthModal?.();
        window.showToast?.('Please sign in first to access the dashboard');
    }
};

// ============================================
// START FREE BUTTON
// ============================================
window.handleStartFreeClick = async function () {
    try {
        const supabase = window.supabaseClient;

        if (!supabase) {
            window.toggleAuthModal?.();
            return;
        }

        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
            window.location.href = '/dashboard.html';
        } else {
            window.toggleAuthModal?.();
        }
    } catch (error) {
        window.toggleAuthModal?.();
    }
};

// ============================================
// FILE UPLOAD INIT
// ============================================
function initFileUpload() {
    const fileUpload = document.getElementById("fileUpload");
    if (!fileUpload) return;

    fileUpload.addEventListener("change", async function (e) {
        const file = e.target.files[0];
        if (!file) return;

        const isAuthenticated = await window.requireAuth?.();
        if (!isAuthenticated) {
            e.target.value = '';
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        const uploadLabel = document.querySelector('label[for="fileUpload"]');
        const originalLabelText = uploadLabel.innerHTML;

        uploadLabel.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Uploading...';
        uploadLabel.style.pointerEvents = 'none';
        uploadLabel.classList.add('opacity-75');

        try {
            window.showToast?.("Uploading and extracting text...", "success");

            const token = await window.getAuthToken?.();
            if (!token) {
                window.showToast?.("Please sign in again.");
                e.target.value = '';
                uploadLabel.innerHTML = originalLabelText;
                uploadLabel.style.pointerEvents = 'auto';
                uploadLabel.classList.remove('opacity-75');
                return;
            }

            const response = await fetch("/api/upload-file", {
                method: "POST",
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const data = await response.json();

            if (data.success && data.text) {
                const courseInput = document.getElementById("courseInput");
                if (courseInput) {
                    courseInput.value = data.text;
                    courseInput.dispatchEvent(new Event('input', { bubbles: true }));
                    window.showToast?.(`✅ File uploaded! ${data.text.length} characters extracted.`, "success");
                    courseInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            } else {
                window.showToast?.(data.error || "Failed to extract text from file");
            }
        } catch (err) {
            window.showToast?.("Upload failed: " + err.message);
        } finally {
            e.target.value = '';
            if (uploadLabel) {
                uploadLabel.innerHTML = originalLabelText;
                uploadLabel.style.pointerEvents = 'auto';
                uploadLabel.classList.remove('opacity-75');
            }
        }
    });
}

// ============================================
// PAYMENT VERIFICATION ON PAGE LOAD
// ============================================
window.addEventListener("load", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const reference = urlParams.get("reference");
    const trxref = urlParams.get("trxref");
    const tx_ref = urlParams.get("tx_ref");

    let paymentReference = reference || trxref || tx_ref;
    if (!paymentReference) return;

    window.showToast?.("Verifying your payment...", "success");

    const token = await window.getAuthToken?.();
    if (!token) {
        window.showToast?.("Please log in again to complete verification.");
        return;
    }

    const savedBillingMode = localStorage.getItem("billingMode") || "monthly";

    try {
        const response = await fetch("/api/verify-payment", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                reference: paymentReference,
                billingMode: savedBillingMode
            })
        });

        const data = await response.json();

        if (data.success) {
            window.showToast?.("🎉 Payment successful! Your account is now Pro!", "success");
            localStorage.removeItem("billingMode");
            window.history.replaceState({}, document.title, window.location.pathname);

            setTimeout(() => {
                if (!window.location.pathname.includes('dashboard.html')) {
                    window.location.href = '/dashboard.html';
                } else {
                    window.location.reload();
                }
            }, 2000);
        } else {
            window.showToast?.("Payment verification failed: " + (data.error || "Unknown error"));
        }
    } catch (err) {
        window.showToast?.("Verification error: " + err.message);
    }
});

// ============================================
// ANIMATED COUNTERS
// ============================================
function animateCounters() {
    const counters = document.querySelectorAll(".counter");

    counters.forEach(counter => {
        const target = parseInt(counter.getAttribute("data-target"));
        const increment = target / 50;
        let count = 0;

        const updateCount = () => {
            count += increment;
            if (count < target) {
                counter.innerText = Math.floor(count).toLocaleString();
                requestAnimationFrame(updateCount);
            } else {
                counter.innerText = target.toLocaleString();
            }
        };

        updateCount();
    });
}

function setupCounterObserver() {
    const counterSection = document.querySelector(".counter")?.closest('section');

    if (!counterSection) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounters();
                observer.disconnect();
            }
        });
    }, { threshold: 0.3 });

    observer.observe(counterSection);
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        setupCounterObserver();
    }, 500);

    initFileUpload();
    detectCountry();
    window.loadWelcomeName();

    document.querySelectorAll('#mobileMenu a').forEach(link => {
        link.addEventListener('click', () => {
            document.getElementById("mobileMenu")?.classList.add("hidden");
        });
    });
});

// ============================================
// EXPOSE GLOBALS
// ============================================
window.userCountry = userCountry;
window.pricingTable = pricingTable;
window.euroCountries = euroCountries;
window.euroPricing = euroPricing;
window.billingMode = billingMode;
window.toggleBilling = toggleBilling;
window.updateModalPricing = updateModalPricing;