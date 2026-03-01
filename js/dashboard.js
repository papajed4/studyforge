// ============================================
// DASHBOARD.JS - Dashboard Only Functions
// ============================================

let fullCourseContext = "";

// Helper function to safely get Supabase
function getSupabase() {
    return window.supabaseClient;
}

// ============================================
// SECTION NAVIGATION
// ============================================
window.showSection = function(section) {
    // Hide all sections
    document.getElementById("generateSection")?.classList.add("hidden");
    document.getElementById("savedSection")?.classList.add("hidden");
    document.getElementById("accountSection")?.classList.add("hidden");

    // Reset nav buttons
    ['navGenerate', 'navSaved', 'navAccount'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.className = "flex items-center gap-3 w-full px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-100 transition";
        }
    });

    // Show selected section
    if (section === "generate") {
        document.getElementById("generateSection")?.classList.remove("hidden");
        const navGenerate = document.getElementById("navGenerate");
        if (navGenerate) {
            navGenerate.className = "flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-indigo-50 text-indigo-600 font-semibold";
        }
    }

    if (section === "saved") {
        document.getElementById("savedSection")?.classList.remove("hidden");
        const navSaved = document.getElementById("navSaved");
        if (navSaved) {
            navSaved.className = "flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-indigo-50 text-indigo-600 font-semibold";
        }
        loadSavedGuides();
    }

    if (section === "account") {
        document.getElementById("accountSection")?.classList.remove("hidden");
        const navAccount = document.getElementById("navAccount");
        if (navAccount) {
            navAccount.className = "flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-indigo-50 text-indigo-600 font-semibold";
        }
        if (window.loadAccountInfo) window.loadAccountInfo();
    }
};

// ============================================
// STUDY GUIDE GENERATION
// ============================================
window.initiateCondense = async function() {
    const isAuthenticated = await window.requireAuth?.();
    if (!isAuthenticated) return;

    const btn = document.getElementById('condenseBtn');
    if (!btn) return;

    const originalBtnText = btn.innerHTML;
    btn.innerHTML = '<span class="loader w-6 h-6 border-2 border-white/30 border-b-white mr-2"></span> Processing...';
    btn.disabled = true;

    const input = document.getElementById('courseInput')?.value.trim() || '';
    const ytInput = document.getElementById("youtubeInput")?.value.trim() || '';

    if (!input && !ytInput) {
        window.showToast?.("Please enter text, upload PDF, or paste a YouTube link.");
        btn.innerHTML = originalBtnText;
        btn.disabled = false;
        return;
    }

    let contentToSend = "";

    try {
        if (input) {
            contentToSend = input;
        }
        else if (ytInput) {
            const ytResponse = await fetch("/api/youtube-transcript", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: ytInput })
            });

            const ytData = await ytResponse.json();

            if (!ytResponse.ok) {
                window.showToast?.(ytData.error || "Transcript unavailable.");
                btn.innerHTML = originalBtnText;
                btn.disabled = false;
                return;
            }

            const courseInput = document.getElementById("courseInput");
            if (courseInput) courseInput.value = ytData.text;
            contentToSend = ytData.text;
        }

        const loadingSection = document.getElementById('loadingSection');
        if (loadingSection) {
            loadingSection.classList.remove('hidden');
            if (window.gsap) {
                gsap.to("#loadingSection", { display: "block", opacity: 1, duration: 0.5 });
            }
        }

        const token = await window.getAuthToken?.();
        if (!token) {
            window.showToast?.("Please sign in again.");
            btn.innerHTML = originalBtnText;
            btn.disabled = false;
            return;
        }

        const response = await fetch('/api/condense', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ content: contentToSend })
        });

        if (!response.ok) throw new Error("Failed to process content");

        const data = await response.json();
        if (!data.success) {
            if (data.error && data.error.includes("Daily limit")) {
                window.toggleUpgradeModal?.();
            } else {
                window.showToast?.(data.error || "Something went wrong.");
            }
            return;
        }

        fullCourseContext = data.data;

        // Auto save
        try {
            if (token) {
                await fetch("/api/save-guide", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        title: "Study Guide - " + new Date().toLocaleDateString(),
                        content: fullCourseContext
                    })
                });
            }
        } catch (err) {
            console.log("Auto-save failed");
        }

        if (window.loadUsage) window.loadUsage();
        buildSections(fullCourseContext);

        if (loadingSection) {
            loadingSection.classList.add('hidden');
            if (window.gsap) {
                gsap.to("#loadingSection", { display: "none", opacity: 0 });
            }
        }

        const resultSection = document.getElementById('resultSection');
        const chatSection = document.getElementById('chatSection');

        if (resultSection) resultSection.classList.remove('hidden');
        if (chatSection) chatSection.classList.remove('hidden');

    } catch (error) {
        console.error(error);
        window.showToast?.("Something went wrong while generating the study guide.");
    }

    btn.innerHTML = originalBtnText;
    btn.disabled = false;
};

function buildSections(text) {
    const container = document.getElementById('exportContainer');
    if (!container) return;
    
    container.innerHTML = '';

    const sectionTitles = [
        "Executive Summary",
        "Key Concepts Explained Simply",
        "Exam-Ready Bullet Points", 
        "Practice Questions",
        "Flashcards (Term - Definition)",
        "Quick Revision Sheet"
    ];

    let remainingText = text;
    const sections = [];

    sectionTitles.forEach(title => {
        const titleIndex = remainingText.indexOf(title);
        if (titleIndex !== -1) {
            let endIndex = remainingText.length;
            for (const nextTitle of sectionTitles) {
                if (nextTitle !== title) {
                    const nextIndex = remainingText.indexOf(nextTitle, titleIndex + title.length);
                    if (nextIndex !== -1 && nextIndex < endIndex) {
                        endIndex = nextIndex;
                    }
                }
            }
            const sectionContent = remainingText.substring(titleIndex, endIndex).trim();
            sections.push(sectionContent);
        }
    });

    if (sections.length === 0) {
        const rawSections = text.split(/^## /gm);
        rawSections.forEach((sectionText, index) => {
            if (!sectionText.trim()) return;
            sections.push(sectionText);
        });
    }

    sections.forEach((sectionText, index) => {
        if (!sectionText.trim()) return;

        let title = sectionText.split('\n')[0].trim();
        let body = sectionText.substring(title.length).trim();
        
        body = body.replace(/[#*`]/g, '');
        body = body.replace(/\n/g, "<br>");

        const wrapper = document.createElement('div');
        wrapper.className = 'glass-panel rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md border border-white/60';

        const header = document.createElement('div');
        header.className = 'p-5 bg-white/40 cursor-pointer flex justify-between items-center select-none';
        header.innerHTML = `
            <h3 class="text-lg font-bold text-slate-800">${title}</h3>
            <i class="fa-solid fa-chevron-down text-slate-400 transition-transform duration-300 transform" id="icon-${index}"></i>
        `;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'accordion-content bg-white/20';
        contentDiv.id = `content-${index}`;
        contentDiv.innerHTML = `<div class="p-6 markdown-body text-slate-700">${body}</div>`;

        let isOpen = index === 0;

        if (isOpen) {
            contentDiv.style.height = 'auto';
            const icon = header.querySelector('i');
            if (icon) icon.classList.add('rotate-180');
        } else {
            contentDiv.style.height = '0';
        }

        header.onclick = () => {
            isOpen = !isOpen;
            const icon = document.getElementById(`icon-${index}`);

            if (isOpen) {
                contentDiv.style.height = contentDiv.scrollHeight + 'px';
                if (icon) icon.classList.add('rotate-180');
            } else {
                contentDiv.style.height = '0';
                if (icon) icon.classList.remove('rotate-180');
            }
        };

        wrapper.appendChild(header);
        wrapper.appendChild(contentDiv);
        container.appendChild(wrapper);
    });
}

// ============================================
// CHAT SYSTEM
// ============================================
window.sendChatMessage = async function() {
    const isAuthenticated = await window.requireAuth?.();
    if (!isAuthenticated) return;

    const inputEl = document.getElementById('chatInput');
    if (!inputEl) return;

    const question = inputEl.value.trim();
    const history = document.getElementById('chatHistory');

    if (!question || !history) return;

    const userBubble = document.createElement('div');
    userBubble.className = "flex justify-end";
    userBubble.innerHTML = `
        <div class="bg-indigo-600 text-white rounded-2xl rounded-tr-none py-3 px-5 max-w-[80%] text-sm shadow-md">
            ${question}
        </div>
    `;
    history.appendChild(userBubble);
    inputEl.value = "";
    history.scrollTop = history.scrollHeight;

    const loadingBubble = document.createElement('div');
    loadingBubble.id = "ai-loading";
    loadingBubble.className = "flex justify-start";
    loadingBubble.innerHTML = `
        <div class="bg-slate-100 text-slate-500 rounded-2xl rounded-tl-none py-3 px-5 text-sm shadow-sm border border-slate-200">
            <i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Thinking...
        </div>
    `;
    history.appendChild(loadingBubble);
    history.scrollTop = history.scrollHeight;

    try {
        const token = await window.getAuthToken?.();
        if (!token) {
            window.showToast?.("Please sign in again.");
            loadingBubble.remove();
            return;
        }

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                question: question,
                context: fullCourseContext
            })
        });

        const data = await response.json();
        if (!data.success) {
            if (data.error && data.error.includes("Daily limit")) {
                window.toggleUpgradeModal?.();
            } else {
                window.showToast?.(data.error || "Something went wrong.");
            }
            return;
        }

        loadingBubble.remove();

        const aiBubble = document.createElement('div');
        aiBubble.className = "flex justify-start";
        aiBubble.innerHTML = `
            <div class="bg-slate-100 text-slate-800 rounded-2xl rounded-tl-none py-3 px-5 max-w-[80%] text-sm shadow-sm border border-slate-200">
                ${data.data}
            </div>
        `;

        if (window.gsap) {
            gsap.from(aiBubble, { opacity: 0, y: 10, duration: 0.3 });
        }
        history.appendChild(aiBubble);
        if (window.loadUsage) await window.loadUsage();
        history.scrollTop = history.scrollHeight;

    } catch (err) {
        loadingBubble.innerHTML = `<div class="bg-red-50 text-red-600 rounded-2xl py-3 px-5 text-sm border border-red-200">Error generating response.</div>`;
    }
};

// ============================================
// EXAM MODE
// ============================================
window.generateExamMode = async function() {
    const isAuthenticated = await window.requireAuth?.();
    if (!isAuthenticated) return;

    if (!fullCourseContext) {
        window.showToast?.("Generate study guide first.");
        return;
    }

    try {
        const token = await window.getAuthToken?.();
        if (!token) {
            window.showToast?.("Please sign in again.");
            return;
        }

        const response = await fetch("/api/exam-mode", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ content: fullCourseContext })
        });

        const data = await response.json();
        if (!data.success) {
            if (data.error && data.error.includes("Daily limit")) {
                window.toggleUpgradeModal?.();
            } else {
                window.showToast?.(data.error || "Something went wrong.");
            }
            return;
        }

        buildSections(data.data);
        if (window.loadUsage) await window.loadUsage();

        const resultSection = document.getElementById("resultSection");
        if (resultSection) {
            window.scrollTo({
                top: resultSection.offsetTop,
                behavior: "smooth"
            });
        }

    } catch (err) {
        window.showToast?.("Exam mode error.");
    }
};

// ============================================
// EXPORT FUNCTIONS
// ============================================
window.exportToPDF = function() {
    const element = document.getElementById('exportContainer');
    if (!element || !window.html2pdf) return;

    // Expand all sections for PDF
    document.querySelectorAll(".accordion-content").forEach(el => {
        el.style.height = 'auto';
    });

    const opt = {
        margin: 10,
        filename: 'StudyForge_AI_Report.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
};

window.exportToNotion = function() {
    if (!fullCourseContext) return;

    const summary = `
# StudyForge Executive Summary

Generated via StudyForge AI

${fullCourseContext}
    `;

    navigator.clipboard.writeText(summary).then(() => {
        window.showToast?.("Markdown copied! Paste it directly into your Notion page.", "success");
    });
};

// ============================================
// SAVED GUIDES
// ============================================
async function loadSavedGuides() {
    const token = await window.getAuthToken?.();
    if (!token) return;

    try {
        const response = await fetch("/api/my-guides", {
            headers: { "Authorization": `Bearer ${token}` }
        });

        const data = await response.json();
        if (!data.success) return;

        const list = document.getElementById("savedGuidesList");
        if (!list) return;

        list.innerHTML = "";

        if (data.guides.length === 0) {
            list.innerHTML = `<p class="text-slate-500 text-sm">No saved guides yet.</p>`;
            return;
        }

        data.guides.forEach(guide => {
            const card = document.createElement("div");
            card.className = "border border-slate-200 rounded-xl p-4 mb-4 bg-slate-50 hover:bg-white transition cursor-pointer";

            card.innerHTML = `
                <div class="flex justify-between items-center">
                    <div>
                        <h3 class="font-semibold text-slate-800">${guide.title}</h3>
                        <p class="text-xs text-slate-500 mt-1">${new Date(guide.created_at).toLocaleDateString()}</p>
                    </div>
                    <button onclick="deleteGuide('${guide.id}')" class="text-red-500 text-sm hover:text-red-600">Delete</button>
                </div>
            `;

            card.addEventListener("click", () => {
                openSavedGuide(guide.content);
            });

            list.appendChild(card);
        });

    } catch (err) {
        console.log("Failed to load guides");
    }
}

function openSavedGuide(content) {
    fullCourseContext = content;
    buildSections(content);

    const resultSection = document.getElementById("resultSection");
    const chatSection = document.getElementById("chatSection");

    if (resultSection) resultSection.classList.remove("hidden");
    if (chatSection) chatSection.classList.remove("hidden");

    window.showSection("generate");
}

window.deleteGuide = async function(id) {
    const confirmDelete = confirm("Are you sure you want to delete this study guide?");
    if (!confirmDelete) return;

    const token = await window.getAuthToken?.();
    if (!token) return;

    try {
        const response = await fetch(`/api/delete-guide/${id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success) {
            window.showToast?.("Study guide deleted.", "success");
            loadSavedGuides();
        } else {
            window.showToast?.("Delete failed.");
        }

    } catch (err) {
        window.showToast?.("Delete error.");
    }
};

// ============================================
// INITIALIZATION - FIXED!
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for Supabase to be ready
    setTimeout(() => {
        const supabase = getSupabase();
        if (!supabase) {
            console.log("Supabase not ready yet, redirecting to home...");
            window.location.href = "/";
            return;
        }
        
        // Check authentication
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                window.location.href = "/";
            }
        }).catch(err => {
            console.error("Auth check error:", err);
            window.location.href = "/";
        });
    }, 500);

    // Chat input listener
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') window.sendChatMessage();
        });
    }

    // Country detection for dashboard
    (async function() {
        try {
            const response = await fetch("https://ipapi.co/json/");
            const data = await response.json();
            window.userCountry = data.country_code || "US";
        } catch (error) {
            window.userCountry = "US";
        }
    })();
});

// ============================================
// EXPOSE FUNCTIONS
// ============================================
window.loadSavedGuides = loadSavedGuides;
window.openSavedGuide = openSavedGuide;