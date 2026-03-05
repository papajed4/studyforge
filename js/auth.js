// ============================================
// AUTH.JS - Authentication Functions
// ============================================

// Initialize Supabase once
(function initSupabase() {
    console.log("Initializing Supabase...");
    
    const SUPABASE_URL = "https://drkgygcoaisvjfppbuxx.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRya2d5Z2NvYWlzdmpmcHBidXh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODU4MzgsImV4cCI6MjA4NzM2MTgzOH0.SqJB7phpKkQLldT06Jqhd1fNOW4e3rllCKHTDtPjKtY";

    // Check if supabase client is available
    if (typeof window.supabase === 'undefined') {
        console.error("Supabase library not loaded yet!");
        return;
    }

    // Only initialize if not already done
    if (!window.supabaseClient) {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("✅ Supabase initialized");
    }
})();

// ============================================
// TOAST NOTIFICATION SYSTEM
// ============================================
window.showToast = function(msg, type = "error") {
    const toast = document.getElementById('errorToast');
    const txt = document.getElementById('errorMsg');
    
    if (!toast) return;

    txt.innerText = msg;
    
    const icon = toast.querySelector('i');
    if (icon) {
        icon.className = type === "success" ? 
            "fa-solid fa-check-circle text-green-400" : 
            "fa-solid fa-circle-exclamation text-red-400";
    }

    if (type === "success") {
        const sound = document.getElementById("successSound");
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(() => {});
        }
    }

    toast.classList.remove('hidden');
    
    if (window.gsap) {
        gsap.fromTo(toast,
            { opacity: 0, y: -20, scale: 0.95 },
            { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "power3.out" }
        );
    }

    setTimeout(hideToast, 4000);
};

function hideToast() {
    const toast = document.getElementById('errorToast');
    if (!toast) return;
    
    if (window.gsap) {
        gsap.to(toast, {
            opacity: 0,
            y: 10,
            duration: 0.3,
            onComplete: () => toast.classList.add('hidden')
        });
    } else {
        toast.classList.add('hidden');
    }
}

// ============================================
// SAFE SUPABASE ACCESS - FIXED!
// ============================================
function getSupabase() {
    return window.supabaseClient;
}

// ============================================
// AUTH HELPER FUNCTIONS
// ============================================
window.requireAuth = async function() {
    const supabase = getSupabase();
    if (!supabase) {
        console.error("Supabase not initialized");
        return false;
    }
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        showToast("Please sign in first to use this feature.");
        if (window.toggleAuthModal) window.toggleAuthModal();
        return false;
    }
    return true;
};

window.getAuthToken = async function() {
    try {
        const supabase = getSupabase();
        if (!supabase) return null;
        
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token || null;
    } catch (error) {
        console.error("Get token error:", error);
        return null;
    }
};

// ============================================
// AUTH MODAL FUNCTIONS
// ============================================
window.toggleAuthModal = function() {
    const modal = document.getElementById('authModal');
    const modalContent = document.getElementById('modalContent');

    if (!modal) return;

    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
        
        if (window.gsap) {
            gsap.to(modal, { opacity: 1, duration: 0.3 });
            gsap.fromTo(modalContent,
                { scale: 0.95, y: 20, opacity: 0 },
                { scale: 1, y: 0, opacity: 1, duration: 0.4, ease: "back.out(1.2)" }
            );
        }
    } else {
        if (window.gsap) {
            gsap.to(modalContent, {
                scale: 0.95,
                y: 20,
                opacity: 0,
                duration: 0.2,
                onComplete: () => {
                    gsap.to(modal, {
                        opacity: 0,
                        duration: 0.2,
                        onComplete: () => {
                            modal.classList.add('hidden');
                            modal.style.opacity = '';
                        }
                    });
                }
            });
        } else {
            modal.classList.add('hidden');
        }
    }
};

window.switchAuthTab = function(tab) {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const loginTab = document.getElementById('loginTab');
    const signupTab = document.getElementById('signupTab');

    if (tab === 'login') {
        loginForm?.classList.remove('hidden');
        signupForm?.classList.add('hidden');
        loginTab?.classList.add('text-indigo-600', 'border-indigo-600');
        loginTab?.classList.remove('text-slate-500');
        signupTab?.classList.remove('text-indigo-600', 'border-indigo-600');
        signupTab?.classList.add('text-slate-500');
    } else {
        loginForm?.classList.add('hidden');
        signupForm?.classList.remove('hidden');
        signupTab?.classList.add('text-indigo-600', 'border-indigo-600');
        signupTab?.classList.remove('text-slate-500');
        loginTab?.classList.remove('text-indigo-600', 'border-indigo-600');
        loginTab?.classList.add('text-slate-500');
    }
};

// ============================================
// SIGNUP / LOGIN FUNCTIONS
// ============================================
window.handleSignup = async function() {
    const supabase = getSupabase();
    if (!supabase) {
        showToast("Authentication system not ready");
        return;
    }
    
    const name = document.getElementById('signupName')?.value;
    const email = document.getElementById('signupEmail')?.value;
    const password = document.getElementById('signupPassword')?.value;

    if (!email || !password) {
        showToast("Please fill all fields");
        return;
    }

    if (password.length < 6) {
        showToast("Password must be at least 6 characters");
        return;
    }

    try {
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: { full_name: name }
            }
        });

        if (error) {
            showToast(error.message);
            return;
        }

        showToast("Signup successful! Check your email to confirm.", "success");
        window.toggleAuthModal();

    } catch (err) {
        showToast(err.message);
    }
};

// ============================================
// LOGIN WITH LOADING STATE
// ============================================
window.handleLogin = async function() {
    const supabase = getSupabase();
    if (!supabase) {
        showToast("Authentication system not ready");
        return;
    }
    
    // Get the login button
    const loginBtn = document.querySelector('#loginForm button');
    const originalText = loginBtn.innerText;
    
    // Show loading state
    loginBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Logging in...';
    loginBtn.disabled = true;
    loginBtn.classList.add('opacity-75', 'cursor-not-allowed');
    
    const email = document.getElementById('loginEmail')?.value;
    const password = document.getElementById('loginPassword')?.value;
    
    if (!email || !password) {
        showToast("Please fill all fields");
        
        // Restore button
        loginBtn.innerHTML = originalText;
        loginBtn.disabled = false;
        loginBtn.classList.remove('opacity-75', 'cursor-not-allowed');
        return;
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            showToast(error.message);
            
            // Restore button
            loginBtn.innerHTML = originalText;
            loginBtn.disabled = false;
            loginBtn.classList.remove('opacity-75', 'cursor-not-allowed');
            return;
        }

        showToast("Login successful!", "success");
        window.toggleAuthModal();
        
        if (window.updateAuthUI) window.updateAuthUI();

        setTimeout(() => {
            if (!window.location.pathname.includes('dashboard.html')) {
                window.location.href = '/dashboard.html';
            }
        }, 1200);

    } catch (err) {
        showToast(err.message);
        
        // Restore button
        loginBtn.innerHTML = originalText;
        loginBtn.disabled = false;
        loginBtn.classList.remove('opacity-75', 'cursor-not-allowed');
    }
};

// ============================================
// UI UPDATE FUNCTIONS
// ============================================
window.updateAuthUI = async function() {
    const supabase = getSupabase();
    if (!supabase) return;
    
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user || null;

    // Desktop elements
    const authButton = document.getElementById('authButton');
    const accountWrapper = document.getElementById('accountDropdownWrapper');
    const dashboardLink = document.getElementById('dashboardLink');
    const usageBadge = document.getElementById('usageBadge');

    // Mobile elements
    const mobileDashboardLink = document.getElementById('mobileDashboardLink');
    const mobileSignInBtn = document.getElementById('mobileSignInBtn');
    const mobileAccountSection = document.getElementById('mobileAccountSection');
    const mobileUserAvatar = document.getElementById('mobileUserAvatar');

    if (user) {
        // Logged in - Desktop
        if (authButton) authButton.classList.add('hidden');
        if (accountWrapper) accountWrapper.classList.remove('hidden');
        if (dashboardLink) dashboardLink.classList.remove('hidden');
        if (usageBadge) usageBadge.classList.remove('hidden');

        // Logged in - Mobile
        if (mobileDashboardLink) mobileDashboardLink.classList.remove('hidden');
        if (mobileSignInBtn) mobileSignInBtn.classList.add('hidden');
        if (mobileAccountSection) mobileAccountSection.classList.remove('hidden');

        // Update avatar
        const name = user.user_metadata?.full_name || 'User';
        const initials = name.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase();
        
        if (mobileUserAvatar) mobileUserAvatar.innerText = initials;
        
        // Load account info
        if (window.loadAccountInfo) window.loadAccountInfo();
        if (window.loadUsage) window.loadUsage();
    } else {
        // Logged out - Desktop
        if (authButton) authButton.classList.remove('hidden');
        if (accountWrapper) accountWrapper.classList.add('hidden');
        if (dashboardLink) dashboardLink.classList.add('hidden');
        if (usageBadge) usageBadge.classList.add('hidden');

        // Logged out - Mobile
        if (mobileDashboardLink) mobileDashboardLink.classList.add('hidden');
        if (mobileSignInBtn) mobileSignInBtn.classList.remove('hidden');
        if (mobileAccountSection) mobileAccountSection.classList.add('hidden');
    }
};

window.logoutUser = async function() {
    const supabase = getSupabase();
    if (!supabase) return;
    
    await supabase.auth.signOut();
    window.updateAuthUI();
    showToast("Logged out successfully", "success");
    
    if (window.location.pathname.includes('dashboard.html')) {
        window.location.href = '/';
    }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================
window.togglePassword = function(inputId, button) {
    const input = document.getElementById(inputId);
    if (!input) return;

    if (input.type === "password") {
        input.type = "text";
        if (button) button.innerText = "👁️‍🗨️";
    } else {
        input.type = "password";
        if (button) button.innerText = "👁";
    }
};

// ============================================
// RESET PASSWORD WITH LOADING STATE
// ============================================
window.resetPassword = async function() {
    const supabase = getSupabase();
    if (!supabase) return;
    
    // Find the forgot password link and get its parent button or create loading state
    const resetLink = event.target;
    const originalText = resetLink.innerText;
    
    // Show loading state on the link
    resetLink.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Sending...';
    resetLink.style.pointerEvents = 'none';
    resetLink.style.opacity = '0.7';
    
    const email = document.getElementById('loginEmail')?.value;
    
    if (!email) {
        showToast("Please enter your email first.");
        
        // Restore link
        resetLink.innerText = originalText;
        resetLink.style.pointerEvents = 'auto';
        resetLink.style.opacity = '1';
        return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
    });

    if (error) {
        showToast(error.message);
    } else {
        showToast("Password reset email sent. Check your inbox.", "success");
    }
    
    // Restore link
    resetLink.innerText = originalText;
    resetLink.style.pointerEvents = 'auto';
    resetLink.style.opacity = '1';
};

// ============================================
// INITIALIZATION - FIXED!
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for Supabase to be ready
    setTimeout(() => {
        const supabase = getSupabase();
        if (supabase) {
            window.updateAuthUI();
            
            // Only set up listener if supabase exists
            try {
                supabase.auth.onAuthStateChange((event, session) => {
                    window.updateAuthUI();
                });
            } catch (e) {
                console.error("Error setting up auth listener:", e);
            }
        } else {
            console.warn("Supabase not ready, retrying in 1 second...");
            setTimeout(arguments.callee, 1000);
        }
    }, 500);
});


// Store signup data temporarily
let pendingSignup = {
    email: '',
    password: '',
    name: ''
};

// ============================================
// HANDLE SIGNUP WITH VERIFICATION
// ============================================
// ============================================
// SIGNUP WITH LOADING STATE
// ============================================
window.handleSignup = async function() {
    const supabase = getSupabase();
    if (!supabase) {
        showToast("Authentication system not ready");
        return;
    }
    
    // Get the signup button
    const signupBtn = document.querySelector('#signupForm button');
    const originalText = signupBtn.innerText;
    
    // Show loading state
    signupBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Creating account...';
    signupBtn.disabled = true;
    signupBtn.classList.add('opacity-75', 'cursor-not-allowed');
    
    const name = document.getElementById('signupName')?.value;
    const email = document.getElementById('signupEmail')?.value;
    const password = document.getElementById('signupPassword')?.value;

    if (!email || !password || !name) {
        showToast("Please fill all fields");
        
        // Restore button
        signupBtn.innerHTML = originalText;
        signupBtn.disabled = false;
        signupBtn.classList.remove('opacity-75', 'cursor-not-allowed');
        return;
    }

    if (password.length < 6) {
        showToast("Password must be at least 6 characters");
        
        // Restore button
        signupBtn.innerHTML = originalText;
        signupBtn.disabled = false;
        signupBtn.classList.remove('opacity-75', 'cursor-not-allowed');
        return;
    }

    try {
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: { full_name: name }
            }
        });

        if (error) {
            showToast(error.message);
            
            // Restore button
            signupBtn.innerHTML = originalText;
            signupBtn.disabled = false;
            signupBtn.classList.remove('opacity-75', 'cursor-not-allowed');
            return;
        }

        showToast("Signup successful! Check your email to confirm.", "success");
        window.toggleAuthModal();
        
        // Restore button (in case modal closes)
        signupBtn.innerHTML = originalText;
        signupBtn.disabled = false;
        signupBtn.classList.remove('opacity-75', 'cursor-not-allowed');

    } catch (err) {
        showToast(err.message);
        
        // Restore button
        signupBtn.innerHTML = originalText;
        signupBtn.disabled = false;
        signupBtn.classList.remove('opacity-75', 'cursor-not-allowed');
    }
};

// ============================================
// VERIFY CODE AND COMPLETE SIGNUP
// ============================================
window.verifySignupCode = async function() {
    const supabase = getSupabase();
    if (!supabase) return;

    // Get the 6-digit code
    const inputs = document.querySelectorAll('.code-input');
    const token = Array.from(inputs).map(input => input.value).join('');
    
    if (token.length !== 6) {
        showToast("Please enter all 6 digits");
        return;
    }

    try {
        showToast("Verifying code...", "success");

        const { data, error } = await supabase.auth.verifyOtp({
            email: pendingSignup.email,
            token: token,
            type: 'signup'
        });

        if (error) {
            showToast("Invalid code: " + error.message);
            return;
        }

        showToast("Email verified! Logging you in...", "success");
        
        // Now sign them in with the stored credentials
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: pendingSignup.email,
            password: pendingSignup.password
        });

        if (signInError) {
            showToast("Auto-login failed. Please log in manually.");
            window.location.href = '/';
            return;
        }

        // Clear pending data
        pendingSignup = { email: '', password: '', name: '' };
        
        // Close modal and go to dashboard
        window.toggleAuthModal();
        setTimeout(() => {
            window.location.href = '/dashboard.html';
        }, 1500);

    } catch (err) {
        showToast("Verification error: " + err.message);
    }
};

// ============================================
// RESEND VERIFICATION CODE
// ============================================
window.resendVerificationCode = async function() {
    const supabase = getSupabase();
    if (!supabase) return;

    if (!pendingSignup.email) {
        showToast("No pending verification found");
        backToSignup();
        return;
    }

    try {
        showToast("Resending code...", "success");
        
        const { error } = await supabase.auth.resend({
            type: 'signup',
            email: pendingSignup.email,
            options: {
                emailRedirectTo: window.location.origin + '/dashboard.html'
            }
        });

        if (error) {
            showToast("Failed to resend: " + error.message);
        } else {
            showToast("New code sent to your email!", "success");
            
            // Clear code inputs
            document.querySelectorAll('.code-input').forEach(input => {
                input.value = '';
            });
            document.querySelector('.code-input')?.focus();
        }

    } catch (err) {
        showToast("Error: " + err.message);
    }
};

// ============================================
// BACK TO SIGNUP FORM
// ============================================
window.backToSignup = function() {
    document.getElementById('signupStep1').classList.remove('hidden');
    document.getElementById('verificationStep').classList.add('hidden');
    
    // Clear pending data
    pendingSignup = { email: '', password: '', name: '' };
    
    // Clear code inputs
    document.querySelectorAll('.code-input').forEach(input => {
        input.value = '';
    });
};

// ============================================
// MOVE TO NEXT CODE INPUT (AUTO-TAB)
// ============================================
window.moveToNext = function(current, index) {
    if (current.value.length === 1) {
        const next = document.querySelectorAll('.code-input')[index + 1];
        if (next) {
            next.focus();
        }
    }
    
    // Handle backspace
    current.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace' && !current.value) {
            const prev = document.querySelectorAll('.code-input')[index - 1];
            if (prev) {
                prev.focus();
            }
        }
    });
};