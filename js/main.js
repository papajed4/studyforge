// ============================================
// MAIN.JS - Shared Functions (Pricing, Modals, etc)
// ============================================

// Global variables
let userCountry = "US";
let billingMode = "monthly";

const pricingTable = {
    NG: { symbol: "₦", monthly: 3500 },
    US: { symbol: "$", monthly: 8.99 },
    GB: { symbol: "£", monthly: 7.99 },
    CA: { symbol: "C$", monthly: 11.99 }  // ADD THIS LINE for Canada
};

const euroCountries = [
    "FR", "DE", "ES", "IT", "NL", "BE", "PT", "IE", "AT", "FI",
    "GR", "LU", "LV", "LT", "EE", "CY", "MT", "SK", "SI"
];

const euroPricing = { symbol: "€", monthly: 8 };

// ============================================
// COUNTRY DETECTION - UPDATE with test country support
// ============================================
async function detectCountry() {
    // Check for test country FIRST
    // const testCountry = localStorage.getItem('testCountry');
    // if (testCountry) {
    //     userCountry = testCountry;
    //     console.log(`🧪 TEST MODE: Using forced country ${userCountry}`);
    //     updatePricingUI();
    //     updateModalPricing();
    //     return;
    // }

    try {
        const response = await fetch("https://ipapi.co/json/");
        const data = await response.json();
        userCountry = data.country_code || "US";
        console.log("🌍 Detected country:", userCountry);
    } catch (error) {
        userCountry = "US";
        console.log("🌍 Country detection failed, defaulting to US");
    }
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

    if (!priceEl) return;

    let pricing = pricingTable[userCountry] ||
        (euroCountries.includes(userCountry) ? euroPricing : pricingTable["US"]);

    const monthlyPrice = pricing.monthly;
    const symbol = pricing.symbol;

    if (billingMode === "monthly") {
        priceEl.innerText = `${symbol}${monthlyPrice}`;
        if (perDayEl) perDayEl.innerText = "Billed monthly";
    } else {
        const yearlyPrice = (monthlyPrice * 12 * 0.8).toFixed(2);
        const perDay = (yearlyPrice / 365).toFixed(2);
        priceEl.innerText = `${symbol}${yearlyPrice}`;
        if (perDayEl) perDayEl.innerText = `≈ ${symbol}${perDay} per day (billed yearly)`;
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

    // Check if yearly mode is selected
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
        // Switch to monthly
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
        // Switch to yearly
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
// HANDLE UPGRADE CLICK - UPDATE with debug logs
// ============================================
window.handleUpgradeClick = async function () {
    // First check if user is already on Pro plan
    const token = await window.getAuthToken?.();
    if (!token) {
        window.showToast?.("Please sign in first.");
        return;
    }

    try {
        // Check current plan
        const response = await fetch("/api/account", {
            headers: { "Authorization": `Bearer ${token}` }
        });

        const accountData = await response.json();

        // If user is already on Pro plan, show message and don't proceed
        if (accountData.success && accountData.plan === "pro") {
            const expiryDate = accountData.expires_at ? new Date(accountData.expires_at).toLocaleDateString() : 'N/A';
            window.showToast?.(`✅ You are already on Pro plan! Expires: ${expiryDate}`, "success");
            return;
        }

        // DEBUG: Check country before proceeding
        console.log("🔍 Current userCountry:", userCountry);
        console.log("🔍 Test country in localStorage:", localStorage.getItem('testCountry'));

        // If not on Pro, continue with normal upgrade flow
        if (!userCountry) {
            console.log("🔍 No userCountry, detecting...");
            await detectCountry();
        }

        // Store billing mode
        localStorage.setItem("billingMode", billingMode);

        // DEBUG: Log what we're sending
        console.log("📤 Sending to server:", {
            country: userCountry,
            billingMode: billingMode
        });

        window.showToast?.("Initializing payment...", "success");

        const initResponse = await fetch("/api/initialize-payment", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                country: userCountry,
                billingMode: billingMode
            })
        });

        const data = await initResponse.json();
        console.log("📥 Server response:", data);

        if (!data.success) {
            window.showToast?.("Payment failed to start: " + (data.error || "Unknown error"));
            return;
        }

        // Store which processor we're using
        localStorage.setItem("paymentProcessor", data.processor);
        console.log("💰 Using processor:", data.processor);

        // Redirect to payment page
        window.location.href = data.authorization_url;

    } catch (err) {
        console.error("❌ Upgrade error:", err);
        window.showToast?.("Payment error: " + err.message);
    }
};


// ============================================
// HANDLE MODAL UPGRADE -
// ============================================
window.handleModalUpgrade = async function () {
    // First check if user is already on Pro plan
    const token = await window.getAuthToken?.();
    if (!token) {
        window.showToast?.("Please sign in first.");
        window.toggleUpgradeModal?.();
        return;
    }

    try {
        // Check current plan
        const response = await fetch("/api/account", {
            headers: { "Authorization": `Bearer ${token}` }
        });

        const accountData = await response.json();

        // If user is already on Pro plan, show message and close modal
        if (accountData.success && accountData.plan === "pro") {
            const expiryDate = accountData.expires_at ? new Date(accountData.expires_at).toLocaleDateString() : 'N/A';
            window.showToast?.(`✅ You are already on Pro plan! Expires: ${expiryDate}`, "success");
            window.toggleUpgradeModal?.(); // Close the modal
            return;
        }

        // If not on Pro, close modal and proceed with upgrade
        window.toggleUpgradeModal?.();
        window.handleUpgradeClick();

    } catch (err) {
        window.showToast?.("Error checking plan status: " + err.message);
        window.toggleUpgradeModal?.(); // Close modal on error
    }
};

// ============================================
// USAGE FUNCTIONS
// ============================================
window.loadUsage = async function () {
    const token = await window.getAuthToken?.();
    if (!token) return;

    try {
        const response = await fetch('/api/usage', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) return;

        const data = await response.json();

        if (data.success) {
            const badge = document.getElementById("usageBadge");
            if (badge) {
                badge.classList.remove("hidden");
                badge.innerText = `${data.used}/5 used today`;

                if (data.used >= 5) {
                    badge.classList.add("text-red-600");
                } else {
                    badge.classList.remove("text-red-600");
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

        // Update avatar for Pro users
        if (data.plan === "pro") {
            const avatar = document.getElementById('userAvatar');
            if (avatar) {
                avatar.classList.remove('bg-indigo-600');
                avatar.classList.add('bg-gradient-to-r', 'from-indigo-600', 'to-purple-600');
            }
        }
        // Update the upgrade button on the pricing page
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
// WELCOME NAME - FIXED VERSION
// ============================================
window.loadWelcomeName = async function () {
    try {
        const supabase = window.supabaseClient; // Use the same global variable
        if (!supabase) {
            console.log("Supabase not ready for welcome name");
            return;
        }

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

window.saveName = async function () {
    const newName = document.getElementById("updateNameInput")?.value;
    if (!newName) return;

    const { error } = await window.supabase.auth.updateUser({
        data: { full_name: newName }
    });

    if (!error) {
        location.reload();
    } else {
        window.showToast?.("Error updating name.");
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
// DASHBOARD REDIRECT - FIXED VERSION
// ============================================
window.handleDashboardClick = async function () {
    try {
        // Check if supabaseClient exists
        const supabase = window.supabaseClient;

        if (!supabase) {
            console.log("Supabase not initialized yet");
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
        console.error("Dashboard click error:", error);
        window.toggleAuthModal?.();
        window.showToast?.('Please sign in first to access the dashboard');
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

        try {
            window.showToast?.("Uploading and extracting text...", "success");

            const token = await window.getAuthToken?.();
            if (!token) {
                window.showToast?.("Please sign in again.");
                e.target.value = '';
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
        }
    });
}

// ============================================
// PAYMENT VERIFICATION ON PAGE LOAD -
// ============================================
window.addEventListener("load", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const reference = urlParams.get("reference");
    const trxref = urlParams.get("trxref"); // Paystack sometimes uses this
    const status = urlParams.get("status"); // Flutterwave returns status
    const tx_ref = urlParams.get("tx_ref"); // Flutterwave returns tx_ref

    // Use appropriate reference based on processor
    let paymentReference = reference || trxref || tx_ref;
    let processor = urlParams.get("processor") || (tx_ref ? "flutterwave" : "paystack");

    if (!paymentReference) return;

    console.log(`💰 Payment reference detected: ${paymentReference} (${processor})`);
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
                billingMode: savedBillingMode,
                processor: processor
            })
        });

        const data = await response.json();

        if (data.success) {
            window.showToast?.("🎉 Payment successful! Your account is now Pro!", "success");
            localStorage.removeItem("billingMode");

            // Clean URL (remove query params)
            window.history.replaceState({}, document.title, window.location.pathname);

            // Redirect to dashboard if not already there
            if (!window.location.pathname.includes('dashboard.html')) {
                setTimeout(() => {
                    window.location.href = '/dashboard.html';
                }, 2000);
            } else {
                // Already on dashboard, just reload to show Pro features
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            }
        } else {
            window.showToast?.("Payment verification failed: " + (data.error || "Unknown error"));
        }
    } catch (err) {
        window.showToast?.("Verification error: " + err.message);
    }
});

// ============================================
// ANIMATED COUNTERS - FIXED VERSION
// ============================================
function animateCounters() {
    console.log("🎯 Starting counter animation...");

    const counters = document.querySelectorAll(".counter");

    if (counters.length === 0) {
        console.log("No counters found on page");
        return;
    }

    console.log(`Found ${counters.length} counters to animate`);

    counters.forEach(counter => {
        const target = parseInt(counter.getAttribute("data-target"));
        const increment = target / 50; // Divide into 50 steps for smooth animation
        let count = 0;

        console.log(`Counter target: ${target}`);

        const updateCount = () => {
            count += increment;
            if (count < target) {
                counter.innerText = Math.floor(count).toLocaleString();
                requestAnimationFrame(updateCount);
            } else {
                counter.innerText = target.toLocaleString();
                console.log(`✅ Counter finished: ${target}`);
            }
        };

        updateCount();
    });
}

// ============================================
// TRIGGER COUNTERS WHEN VISIBLE - FIXED
// ============================================
function setupCounterObserver() {
    const counterSection = document.querySelector(".counter")?.closest('section');

    if (!counterSection) {
        console.log("Counter section not found");
        return;
    }

    console.log("Setting up counter observer");

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                console.log("👁️ Counter section visible - starting animation");
                animateCounters();
                observer.disconnect(); // Only animate once
            }
        });
    }, { threshold: 0.3 }); // Trigger when 30% visible

    observer.observe(counterSection);
}

// Run when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure DOM is ready
    setTimeout(() => {
        setupCounterObserver();
    }, 500);
});

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
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