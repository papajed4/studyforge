// ============================================
// MAIN.JS - Shared Functions (Pricing, Modals, etc)
// ============================================

// Global variables
let userCountry = "US";
let billingMode = "monthly";

const pricingTable = {
    NG: { symbol: "₦", monthly: 3500 },      // Fixed: ₦3,500 (not 350,000 - this is for display only)
    US: { symbol: "$", monthly: 8.99 },
    GB: { symbol: "£", monthly: 7.99 },
    CA: { symbol: "C$", monthly: 11.99 }
};

const euroCountries = [
    "FR", "DE", "ES", "IT", "NL", "BE", "PT", "IE", "AT", "FI",
    "GR", "LU", "LV", "LT", "EE", "CY", "MT", "SK", "SI"
];

const euroPricing = { symbol: "€", monthly: 8 };

// ============================================
// COUNTRY DETECTION - Test mode commented out
// ============================================
async function detectCountry() {
    // TEST MODE - Uncomment to force a country for testing
    /*
    const testCountry = localStorage.getItem('testCountry');
    if (testCountry) {
        userCountry = testCountry;
        console.log(`🧪 TEST MODE: Using forced country ${userCountry}`);
        updatePricingUI();
        updateModalPricing();
        return;
    }
    */

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
// HANDLE UPGRADE CLICK - With Pro plan check
// ============================================
// ============================================
// UPGRADE CLICK WITH LOADING STATE
// ============================================
window.handleUpgradeClick = async function () {
    // Get the upgrade button that was clicked
    const upgradeBtn = event.target.closest('button');
    const originalText = upgradeBtn.innerText;

    // Show loading state
    upgradeBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Preparing payment...';
    upgradeBtn.disabled = true;
    upgradeBtn.classList.add('opacity-75', 'cursor-not-allowed');

    const token = await window.getAuthToken?.();
    if (!token) {
        window.showToast?.("Please sign in first.");

        // Restore button
        upgradeBtn.innerHTML = originalText;
        upgradeBtn.disabled = false;
        upgradeBtn.classList.remove('opacity-75', 'cursor-not-allowed');
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

            // Restore button
            upgradeBtn.innerHTML = originalText;
            upgradeBtn.disabled = false;
            upgradeBtn.classList.remove('opacity-75', 'cursor-not-allowed');
            return;
        }

        if (!userCountry) {
            await detectCountry();
        }

        localStorage.setItem("billingMode", billingMode);

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

        if (!data.success) {
            window.showToast?.("Payment failed to start: " + (data.error || "Unknown error"));

            // Restore button
            upgradeBtn.innerHTML = originalText;
            upgradeBtn.disabled = false;
            upgradeBtn.classList.remove('opacity-75', 'cursor-not-allowed');
            return;
        }

        localStorage.setItem("paymentProcessor", data.processor);

        // DON'T restore button - we're redirecting!
        window.location.href = data.authorization_url;

    } catch (err) {
        console.error("❌ Upgrade error:", err);
        window.showToast?.("Payment error: " + err.message);

        // Restore button
        upgradeBtn.innerHTML = originalText;
        upgradeBtn.disabled = false;
        upgradeBtn.classList.remove('opacity-75', 'cursor-not-allowed');
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

        // Note: handleUpgradeClick will handle its own loading states

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
// USAGE FUNCTIONS - UPDATED (Hides for Pro users)
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

        // If user is Pro, hide the usage badge completely
        if (accountData.success && accountData.plan === "pro") {
            const badge = document.getElementById("usageBadge");
            if (badge) {
                badge.classList.add("hidden");
            }
            return; // Don't fetch usage for Pro users
        }

        // Only fetch usage for Free users
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
// ACCOUNT FUNCTIONS - THIS IS IN MAIN.JS
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
            
            // 👇 ADD THIS - HIDE UPGRADE MESSAGE FOR PRO USERS
            const upgradeMessage = document.querySelector('#accountSection .bg-amber-50');
            if (upgradeMessage) {
                upgradeMessage.classList.add('hidden');
            }
            
        } else {
            // 👇 ADD THIS - SHOW UPGRADE MESSAGE FOR FREE USERS
            const upgradeMessage = document.querySelector('#accountSection .bg-amber-50');
            if (upgradeMessage) {
                upgradeMessage.classList.remove('hidden');
            }
        }

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

    // Show loading state
    saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Saving...';
    saveBtn.disabled = true;
    saveBtn.classList.add('opacity-75', 'cursor-not-allowed');

    const newName = document.getElementById("updateNameInput")?.value;
    if (!newName) {
        window.showToast?.("Please enter a name");

        // Restore button
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

        // Restore button
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
// FILE UPLOAD INIT - FIXED VERSION
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

        // Get upload label and store original text BEFORE try block
        const uploadLabel = document.querySelector('label[for="fileUpload"]');
        const originalLabelText = uploadLabel.innerHTML;

        // Show loading state
        uploadLabel.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Uploading...';
        uploadLabel.style.pointerEvents = 'none';
        uploadLabel.classList.add('opacity-75');

        try {
            window.showToast?.("Uploading and extracting text...", "success");

            const token = await window.getAuthToken?.();
            if (!token) {
                window.showToast?.("Please sign in again.");
                e.target.value = '';

                // Restore upload label
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
            // Restore upload label
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