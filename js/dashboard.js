// ============================================
// DASHBOARD.JS - COMPLETE VERSION WITH ALL FEATURES
// ============================================

console.log("🚀 Dashboard JS loading...");

// ============================================
// GLOBAL VARIABLES
// ============================================
let fullCourseContext = "";
let userLibrary = [];
let libraryFilter = '';
let currentDetectedLanguage = 'en';
let quizScore = {
    correct: 0,
    total: 0,
    answers: []
};

let selectedTags = [];
let studyModeData = {
    type: 'flashcard',
    items: [],
    currentIndex: 0
};

let guideToDelete = null;
let autoSaveTimer = null;
let lastSaveTime = null;
let saveTimeout;

// ============================================
// HELPER FUNCTIONS
// ============================================
function getSupabase() {
    return window.supabaseClient;
}

// ============================================
// GOOGLE ANALYTICS EVENT TRACKING
// ============================================

// Track page views
function trackPageView(pageName) {
    if (typeof gtag !== 'undefined') {
        gtag('event', 'page_view', {
            'page_title': pageName,
            'page_location': window.location.href
        });
    }
}

// Track generate
function trackGenerate(guideTitle, contentLength) {
    if (typeof gtag !== 'undefined') {
        gtag('event', 'generate_guide', {
            'event_category': 'study',
            'event_label': guideTitle,
            'value': contentLength
        });
    }
}

// Track upgrade
function trackUpgrade(plan) {
    if (typeof gtag !== 'undefined') {
        gtag('event', 'upgrade', {
            'event_category': 'subscription',
            'event_label': plan
        });
    }
}

// ============================================
// SECTION NAVIGATION WITH TRANSITIONS
// ============================================
window.showSection = function (section) {
    console.log("showSection called:", section);

    const sections = {
        generate: document.getElementById('generateSection'),
        saved: document.getElementById('savedSection'),
        account: document.getElementById('accountSection'),
        analytics: document.getElementById('analyticsSection')
    };

    // Find current visible section
    let currentSection = null;
    for (let key in sections) {
        if (sections[key] && !sections[key].classList.contains('hidden')) {
            currentSection = sections[key];
            break;
        }
    }

    const targetSection = sections[section];
    if (!targetSection) return;

    // If same section, do nothing
    if (currentSection === targetSection) return;

    // Animate out current section
    if (currentSection) {
        currentSection.style.animation = 'fadeOut 0.15s ease forwards';
        setTimeout(() => {
            currentSection.classList.add('hidden');
            currentSection.style.animation = '';
        }, 150);
    }

    // Animate in target section
    setTimeout(() => {
        targetSection.classList.remove('hidden');
        targetSection.style.animation = 'fadeSlideIn 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1)';
        setTimeout(() => {
            targetSection.style.animation = '';
        }, 300);
    }, currentSection ? 150 : 0);

    // Update nav buttons
    const navButtons = {
        generate: document.getElementById('navGenerate'),
        saved: document.getElementById('navSaved'),
        account: document.getElementById('navAccount'),
        analytics: document.getElementById('navAnalytics')
    };

    for (let key in navButtons) {
        if (navButtons[key]) {
            navButtons[key].className = "flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-all";
        }
    }

    if (navButtons[section]) {
        navButtons[section].className = "flex items-center gap-3 w-full px-4 py-3.5 rounded-xl bg-indigo-50 text-indigo-600 font-semibold transition-all active:bg-indigo-100";
    }

    // Load data based on section
    if (section === 'saved') loadSavedGuides();
    if (section === 'analytics' && typeof loadAnalytics === 'function') loadAnalytics();
    if (section === 'account') {
        if (window.loadAccountInfo) window.loadAccountInfo();
        if (typeof loadProfileData === 'function') loadProfileData();
    }
    if (section === 'generate' && window.loadWelcomeName) window.loadWelcomeName();

    // Update mobile title
    const mobileTitle = document.getElementById('mobileSectionTitle');
    if (mobileTitle) {
        const titles = { generate: 'Generate', saved: 'My Study Guides', account: 'Account', analytics: 'Analytics' };
        mobileTitle.textContent = titles[section] || 'Dashboard';
    }

    // Close sidebar on mobile
    if (window.innerWidth < 768) toggleSidebar();
};

// ============================================
// TOGGLE SIDEBAR
// ============================================
window.toggleSidebar = function () {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    if (sidebar) sidebar.classList.toggle("-translate-x-full");
    if (overlay) overlay.classList.toggle("hidden");
};

// ============================================
// STUDY GUIDE GENERATION
// ============================================
window.initiateCondense = async function () {
    console.log("Generate clicked");

    const isAuthenticated = await window.requireAuth?.();
    if (!isAuthenticated) return;

    const btn = document.getElementById('condenseBtn');
    if (!btn) return;

    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="loader w-6 h-6 border-2 border-white/30 border-b-white mr-2"></span> Processing...';
    btn.disabled = true;

    const input = document.getElementById('courseInput')?.value.trim();
    const ytInput = document.getElementById('youtubeInput')?.value.trim();

    // Language detection from pasted text
    if (input && !ytInput && !currentDetectedLanguage) {
        const hasGermanChars = /[äöüß]/i.test(input);
        const hasFrenchChars = /[éèêëàâç]/i.test(input);
        const hasSpanishChars = /[ñáéíóúü]/i.test(input);

        if (hasGermanChars) currentDetectedLanguage = 'de';
        else if (hasFrenchChars) currentDetectedLanguage = 'fr';
        else if (hasSpanishChars) currentDetectedLanguage = 'es';
        else currentDetectedLanguage = 'en';
        console.log("📝 Detected language from text:", currentDetectedLanguage);
    }

    let guideTitle = document.getElementById('guideTitle')?.value.trim();
    if (!guideTitle || guideTitle === 'Study Guide - ') {
        const date = new Date().toLocaleDateString();
        guideTitle = `Study Guide - ${date}`;
    }

    if (!input && !ytInput) {
        if (window.showToast) window.showToast("Please enter text or a YouTube link");
        btn.innerHTML = originalText;
        btn.disabled = false;
        return;
    }

    const loading = document.getElementById('loadingSection');
    const result = document.getElementById('resultSection');
    const chat = document.getElementById('chatSection');

    if (loading) {
        loading.classList.remove('hidden');
        loading.innerHTML = `<div class="loader mb-4"></div><h3 class="text-xl font-bold text-slate-800 mb-4">Generating your study guide...</h3><p class="text-sm text-slate-500">This may take a few moments</p>`;
    }

    try {
        let contentToSend = input;

        if (ytInput && !input) {
            const ytResponse = await fetch("/api/youtube-transcript", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: ytInput })
            });
            const ytData = await ytResponse.json();
            if (ytData.success) {
                contentToSend = ytData.text;
                document.getElementById('courseInput').value = ytData.text;
            }
        }

        const token = await window.getAuthToken?.();
        if (!token) {
            if (window.showToast) window.showToast("Please sign in again");
            btn.innerHTML = originalText;
            btn.disabled = false;
            if (loading) loading.classList.add('hidden');
            return;
        }

        const response = await fetch('/api/condense', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                content: contentToSend,
                language: currentDetectedLanguage || 'en'
            })
        });

        const data = await response.json();

        if (data.success) {
            fullCourseContext = data.data;
            console.log("✅ Content generated, length:", fullCourseContext.length);

            buildFullSections(fullCourseContext);

            if (loading) loading.classList.add('hidden');
            if (result) result.classList.remove('hidden');
            if (chat) chat.classList.remove('hidden');

            const saveResponse = await fetch("/api/save-guide", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: guideTitle,
                    content: fullCourseContext,
                    subject: document.getElementById('guideSubject')?.value.trim() || '',
                    course_code: document.getElementById('guideCourseCode')?.value.trim() || '',
                    tags: selectedTags || []
                })
            });

            const saveData = await saveResponse.json();
            console.log("Save result:", saveData);

            if (saveData.success) {
                if (window.showToast) window.showToast(`✅ Saved: "${guideTitle}"`, "success");
                if (saveData.data && saveData.data[0]) {
                    saveLastGeneratedGuide(guideTitle, saveData.data[0].id);
                }
            } else {
                if (window.showToast) window.showToast("Generated but save failed", "error");
            }

        } else {
            if (data.error && data.error.includes("Daily limit")) {
                if (window.showProUpgradeOverlay) {
                    window.showProUpgradeOverlay();
                } else {
                    window.toggleUpgradeModal?.();
                }
            } else {
                if (window.showToast) window.showToast(data.error || "Generation failed");
            }
            if (loading) loading.classList.add('hidden');
        }

    } catch (err) {
        console.error("Error:", err);
        if (window.showToast) window.showToast("Error generating study guide");
        if (loading) loading.classList.add('hidden');
    }

    btn.innerHTML = originalText;
    btn.disabled = false;
};

// ============================================
// BUILD SECTIONS (ACCORDION)
// ============================================
function buildFullSections(text) {
    console.log("Building accordion sections with text length:", text?.length || 0);

    const container = document.getElementById('exportContainer');
    if (!container) return;
    container.innerHTML = '';

    const sectionTitles = [
        "📌 CORE CONCEPTS",
        "📋 KEY DEFINITIONS",
        "⚖️ IMPORTANT LAWS/FORMULAS",
        "🎯 LIKELY EXAM TOPICS",
        "Executive Summary",
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
        container.innerHTML = `<div class="p-6 bg-white rounded-xl">${text.replace(/\n/g, '<br>')}</div>`;
        return;
    }

    sections.forEach((sectionText, index) => {
        if (!sectionText.trim()) return;

        const lines = sectionText.split('\n');
        const title = lines[0].trim();
        let body = lines.slice(1).join('\n').trim();
        body = body.replace(/\n/g, '<br>');
        body = body.replace(/- /g, '• ');

        const wrapper = document.createElement('div');
        wrapper.className = 'bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200 mb-4';

        const header = document.createElement('div');
        header.className = 'p-4 bg-slate-50 cursor-pointer flex justify-between items-center select-none hover:bg-slate-100 transition';
        header.innerHTML = `
            <h3 class="font-bold text-slate-800">${title}</h3>
            <i class="fa-solid fa-chevron-down text-slate-400 transition-transform duration-300" id="icon-${index}"></i>
        `;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'accordion-content overflow-hidden transition-all duration-300';
        contentDiv.id = `content-${index}`;
        contentDiv.innerHTML = `<div class="p-4 markdown-body text-slate-700 border-t border-slate-200">${body}</div>`;

        let isOpen = (index === 0);
        if (isOpen) {
            contentDiv.style.height = contentDiv.scrollHeight + 'px';
            const icon = header.querySelector('i');
            if (icon) icon.classList.add('rotate-180');
        } else {
            contentDiv.style.height = '0';
        }

        header.onclick = function () {
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

    console.log("Accordion sections built:", sections.length);
}

// ============================================
// OPEN SAVED GUIDE
// ============================================
window.openSavedGuide = function (id) {
    console.log("🔵 OPEN SAVED GUIDE CALLED");

    const guide = userLibrary.find(g => g.id === id);
    if (!guide) {
        console.error("Guide not found!");
        return;
    }

    window.currentGuideId = id;
    fullCourseContext = guide.content;

    const chatSection = document.getElementById('chatSection');
    if (chatSection) {
        chatSection.classList.remove('hidden');
        chatSection.style.display = 'block';
    }

    const chatHistory = document.getElementById('chatHistory');
    if (chatHistory) {
        chatHistory.innerHTML = '<div class="text-xs text-slate-400 text-center mb-2">Chat ready! Ask questions about this guide.</div>';
    }

    buildFullSections(guide.content);

    const generateSection = document.getElementById('generateSection');
    const savedSection = document.getElementById('savedSection');
    const accountSection = document.getElementById('accountSection');

    if (generateSection) generateSection.classList.remove('hidden');
    if (savedSection) savedSection.classList.add('hidden');
    if (accountSection) accountSection.classList.add('hidden');

    const navGenerate = document.getElementById('navGenerate');
    const navSaved = document.getElementById('navSaved');
    const navAccount = document.getElementById('navAccount');

    if (navGenerate) navGenerate.className = "flex items-center gap-3 w-full px-4 py-3.5 rounded-xl bg-indigo-50 text-indigo-600 font-semibold";
    if (navSaved) navSaved.className = "flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-slate-600 hover:bg-slate-100";
    if (navAccount) navAccount.className = "flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-slate-600 hover:bg-slate-100";

    const mobileTitle = document.getElementById('mobileSectionTitle');
    if (mobileTitle) mobileTitle.textContent = 'Generate';

    const resultSection = document.getElementById('resultSection');
    if (resultSection) {
        resultSection.classList.remove('hidden');
        resultSection.style.display = 'block';
    }

    const titleInput = document.getElementById('guideTitle');
    if (titleInput) titleInput.value = guide.title || 'Study Guide - ';

    const subjectInput = document.getElementById('guideSubject');
    if (subjectInput) subjectInput.value = guide.subject || '';

    const courseCodeInput = document.getElementById('guideCourseCode');
    if (courseCodeInput) courseCodeInput.value = guide.course_code || '';

    selectedTags = guide.tags || [];
    if (typeof renderSelectedTags === 'function') renderSelectedTags();

    setupAutoSaveListeners(id);

    if (window.showToast) window.showToast(`📚 Loaded "${guide.title || 'Study Guide'}"`, "success");
    console.log("✅ Guide loaded successfully");
};

// ============================================
// AUTO-SAVE LISTENERS
// ============================================
function setupAutoSaveListeners(guideId) {
    const inputs = ['guideTitle', 'guideSubject', 'guideCourseCode', 'guideTags'];
    inputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            const newInput = input.cloneNode(true);
            input.parentNode.replaceChild(newInput, input);
            newInput.addEventListener('input', () => triggerAutoSave(guideId));
        }
    });

    const originalAddTag = window.addTag;
    window.addTag = function (tag) {
        originalAddTag(tag);
        triggerAutoSave(guideId);
    };

    const originalRemoveTag = window.removeTag;
    window.removeTag = function (tag) {
        originalRemoveTag(tag);
        triggerAutoSave(guideId);
    };
}

// ============================================
// AUTO-UPDATE FUNCTIONS
// ============================================
window.saveGuideChanges = async function (guideId) {
    console.log("Saving changes for guide:", guideId);

    const token = await window.getAuthToken?.();
    if (!token) {
        if (window.showToast) window.showToast("Please sign in again");
        return false;
    }

    const guide = userLibrary.find(g => g.id === guideId);
    if (!guide) return false;

    const updatedTitle = document.getElementById('guideTitle')?.value.trim() || guide.title;
    const updatedSubject = document.getElementById('guideSubject')?.value.trim() || guide.subject || '';
    const updatedCourseCode = document.getElementById('guideCourseCode')?.value.trim() || guide.course_code || '';

    try {
        const response = await fetch(`/api/update-guide/${guideId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title: updatedTitle,
                subject: updatedSubject,
                course_code: updatedCourseCode,
                tags: selectedTags
            })
        });

        const data = await response.json();

        if (data.success) {
            const index = userLibrary.findIndex(g => g.id === guideId);
            if (index !== -1) {
                userLibrary[index].title = updatedTitle;
                userLibrary[index].subject = updatedSubject;
                userLibrary[index].course_code = updatedCourseCode;
                userLibrary[index].tags = selectedTags;
            }

            if (window.showToast) window.showToast("✅ Changes saved!", "success");
            updateAutoSaveIndicator();

            if (!document.getElementById('savedSection').classList.contains('hidden')) {
                loadSavedGuides();
            }
            return true;
        } else {
            if (window.showToast) window.showToast("Failed to save changes");
            return false;
        }

    } catch (err) {
        console.error("Error saving changes:", err);
        if (window.showToast) window.showToast("Error saving changes");
        return false;
    }
};

window.triggerAutoSave = function (guideId) {
    if (saveTimeout) clearTimeout(saveTimeout);

    const indicator = document.getElementById('autoSaveIndicator');
    const timeSpan = document.getElementById('autoSaveTime');
    if (indicator && timeSpan) {
        indicator.classList.remove('hidden');
        timeSpan.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Saving...';
    }

    saveTimeout = setTimeout(() => {
        saveGuideChanges(guideId);
    }, 1000);
};

// ============================================
// CHAT SYSTEM
// ============================================
window.sendChatMessage = async function () {
    console.log("Chat function called");
    console.log("fullCourseContext length:", fullCourseContext?.length);

    if (!fullCourseContext) {
        if (window.showToast) window.showToast("Please generate or load a study guide first");
        return;
    }

    const isAuthenticated = await window.requireAuth?.();
    if (!isAuthenticated) return;

    const input = document.getElementById('chatInput');
    const history = document.getElementById('chatHistory');
    if (!input || !history || !input.value.trim()) return;

    const question = input.value.trim();
    input.value = '';

    const userDiv = document.createElement('div');
    userDiv.className = 'flex justify-end';
    userDiv.innerHTML = '<div class="bg-indigo-600 text-white rounded-2xl rounded-tr-none py-2 px-4 max-w-[80%]">' + question + '</div>';
    history.appendChild(userDiv);

    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'aiLoading';
    loadingDiv.className = 'flex justify-start';
    loadingDiv.innerHTML = '<div class="bg-slate-100 rounded-2xl rounded-tl-none py-2 px-4"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Thinking...</div>';
    history.appendChild(loadingDiv);
    history.scrollTop = history.scrollHeight;

    try {
        const token = await window.getAuthToken?.();
        if (!token) {
            if (window.showToast) window.showToast("Please sign in again");
            loadingDiv.remove();
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
        document.getElementById('aiLoading')?.remove();

        if (data.success) {
            const aiDiv = document.createElement('div');
            aiDiv.className = 'flex justify-start';
            aiDiv.innerHTML = '<div class="bg-slate-100 rounded-2xl rounded-tl-none py-2 px-4">' + data.data + '</div>';
            history.appendChild(aiDiv);
        } else {
            if (data.error && data.error.includes("Daily limit")) {
                if (window.showProUpgradeOverlay) window.showProUpgradeOverlay();
            } else {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'flex justify-start';
                errorDiv.innerHTML = '<div class="bg-red-50 text-red-600 rounded-2xl py-2 px-4">' + (data.error || "Error") + '</div>';
                history.appendChild(errorDiv);
            }
        }
        history.scrollTop = history.scrollHeight;

    } catch (err) {
        console.error(err);
        document.getElementById('aiLoading')?.remove();
        const errorDiv = document.createElement('div');
        errorDiv.className = 'flex justify-start';
        errorDiv.innerHTML = '<div class="bg-red-50 text-red-600 rounded-2xl py-2 px-4">Error connecting to chat</div>';
        history.appendChild(errorDiv);
        history.scrollTop = history.scrollHeight;
    }
};

// ============================================
// EXAM MODE
// ============================================
window.generateExamMode = async function () {
    console.log("Exam mode");

    const isAuthenticated = await window.requireAuth?.();
    if (!isAuthenticated) return;

    if (!fullCourseContext) {
        if (window.showToast) window.showToast("Generate a study guide first");
        return;
    }

    const examBtn = document.querySelector('button[onclick="generateExamMode()"]');
    const originalText = examBtn ? examBtn.innerHTML : '';
    if (examBtn) {
        examBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Generating...';
        examBtn.disabled = true;
    }

    try {
        const token = await window.getAuthToken?.();
        if (!token) {
            if (window.showToast) window.showToast("Please sign in again");
            return;
        }

        const response = await fetch("/api/exam-mode", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ content: fullCourseContext })
        });

        const data = await response.json();

        if (data.success) {
            buildFullSections(data.data);

            const header = document.querySelector('#resultSection h2');
            if (header) {
                header.innerHTML = '📝 Exam Mode <span class="text-sm bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full ml-2">Active</span>';
                setTimeout(() => header.innerHTML = 'Study Guide', 5000);
            }

            if (window.showToast) window.showToast("📝 Exam Mode Activated!", "success");

            const result = document.getElementById('resultSection');
            if (result) result.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            if (data.error && data.error.includes("Daily limit")) {
                if (window.toggleUpgradeModal) window.toggleUpgradeModal();
            } else {
                if (window.showToast) window.showToast(data.error || "Something went wrong");
            }
        }

    } catch (err) {
        console.error(err);
        if (window.showToast) window.showToast("Error generating exam mode");
    } finally {
        if (examBtn) {
            examBtn.innerHTML = originalText;
            examBtn.disabled = false;
        }
    }
};

// ============================================
// EXPORT FUNCTIONS
// ============================================
window.exportToPDF = function () {
    if (!fullCourseContext) {
        if (window.showToast) window.showToast("No content to export");
        return;
    }

    const element = document.getElementById('exportContainer');
    if (element && window.html2pdf) {
        document.querySelectorAll(".accordion-content").forEach(el => el.style.height = 'auto');

        const opt = {
            margin: 10,
            filename: 'StudyForge_' + new Date().toISOString().slice(0, 10) + '.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        window.html2pdf().set(opt).from(element).save();

        setTimeout(() => {
            document.querySelectorAll(".accordion-content").forEach(el => {
                if (!el.classList.contains('open')) el.style.height = '0';
            });
        }, 1000);
    } else {
        if (window.showToast) window.showToast("PDF export coming soon");
    }
};

window.exportToNotion = function () {
    if (!fullCourseContext) return;

    const summary = `# StudyForge Study Guide\n\nGenerated on ${new Date().toLocaleDateString()}\n\n${fullCourseContext}`;
    navigator.clipboard.writeText(summary).then(() => {
        if (window.showToast) window.showToast("Copied to clipboard! Paste into Notion.", "success");
    }).catch(() => {
        if (window.showToast) window.showToast("Could not copy to clipboard");
    });
};

// ============================================
// TAG MANAGEMENT SYSTEM
// ============================================
window.addTagFromInput = function () {
    const input = document.getElementById('guideTags');
    const tags = input.value.split(',').map(t => t.trim()).filter(t => t.length > 0);
    tags.forEach(tag => {
        if (!selectedTags.includes(tag)) selectedTags.push(tag);
    });
    input.value = '';
    renderSelectedTags();
};

window.addTag = function (tag) {
    if (!selectedTags.includes(tag)) {
        selectedTags.push(tag);
        renderSelectedTags();
    }
};

window.removeTag = function (tag) {
    selectedTags = selectedTags.filter(t => t !== tag);
    renderSelectedTags();
};

function renderSelectedTags() {
    const container = document.getElementById('selectedTagsContainer');
    if (!container) return;

    if (selectedTags.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400">No tags selected</p>';
        return;
    }

    let html = '';
    selectedTags.forEach(tag => {
        html += `
            <span class="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-xs">
                ${tag}
                <button onclick="removeTag('${tag}')" class="hover:text-indigo-900">
                    <i class="fa-solid fa-times"></i>
                </button>
            </span>
        `;
    });
    container.innerHTML = html;
}

// ============================================
// ENHANCED LIBRARY SYSTEM
// ============================================
window.loadSavedGuides = async function () {
    console.log("Loading saved guides");

    const loading = document.getElementById('libraryLoading');
    const empty = document.getElementById('emptyLibrary');
    const grid = document.getElementById('libraryGrid');
    const count = document.getElementById('guideCount');

    if (loading) loading.classList.remove('hidden');
    if (empty) empty.classList.add('hidden');
    if (grid) grid.innerHTML = '';

    const token = await window.getAuthToken?.();
    if (!token) {
        if (loading) loading.classList.add('hidden');
        if (empty) empty.classList.remove('hidden');
        return;
    }

    try {
        const response = await fetch("/api/my-guides", {
            headers: { "Authorization": `Bearer ${token}` }
        });

        const data = await response.json();
        if (loading) loading.classList.add('hidden');

        if (data.success && data.guides && data.guides.length > 0) {
            userLibrary = data.guides;
            console.log("Library loaded with", userLibrary.length, "guides");
            if (userLibrary[0]) console.log("First guide content length:", userLibrary[0].content?.length);
            if (count) count.textContent = userLibrary.length;
            if (empty) empty.classList.add('hidden');

            // 👇 ADD THIS LINE RIGHT HERE - after getting userLibrary
            const quizStats = await fetchQuizStatsForGuides(userLibrary);

            // Group by subject
            const groupedBySubject = {};
            userLibrary.forEach(guide => {
                const subject = guide.subject || 'Uncategorized';
                if (!groupedBySubject[subject]) groupedBySubject[subject] = [];
                groupedBySubject[subject].push(guide);
            });

            // Render guides grouped by subject
            let html = '';

            for (const subject in groupedBySubject) {
                html += `
                    <div class="col-span-2 mb-4">
                        <h3 class="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                            <span class="w-1 h-4 bg-indigo-400 rounded-full"></span>
                            ${subject} <span class="text-xs text-slate-400">(${groupedBySubject[subject].length})</span>
                        </h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                `;

                // 👇 REPLACE THE ENTIRE groupedBySubject[subject].forEach LOOP with the enhanced version
                groupedBySubject[subject].forEach(guide => {
                    const date = new Date(guide.created_at).toLocaleDateString();
                    const stats = quizStats[guide.id];  // 👈 GET STATS FOR THIS GUIDE

                    // Build tags HTML
                    let tagsHtml = '';
                    if (guide.tags && guide.tags.length > 0) {
                        guide.tags.slice(0, 3).forEach(tag => {
                            tagsHtml += `<span class="px-2 py-0.5 bg-slate-100 rounded-full text-xs text-slate-600">${tag}</span>`;
                        });
                        if (guide.tags.length > 3) {
                            tagsHtml += `<span class="text-xs text-slate-400">+${guide.tags.length - 3}</span>`;
                        }
                    }

                    // Build analytics badge
                    let analyticsBadge = '';
                    if (stats) {
                        let badgeColor = '';
                        let badgeIcon = '';
                        let score = stats.last_score;

                        if (score >= 80) {
                            badgeColor = 'bg-emerald-100 text-emerald-700';
                            badgeIcon = '🏆';
                        } else if (score >= 60) {
                            badgeColor = 'bg-blue-100 text-blue-700';
                            badgeIcon = '📘';
                        } else if (score >= 40) {
                            badgeColor = 'bg-amber-100 text-amber-700';
                            badgeIcon = '📖';
                        } else if (stats.needs_review) {
                            badgeColor = 'bg-red-100 text-red-700';
                            badgeIcon = '⚠️';
                        }

                        if (stats.attempts_count > 0) {
                            analyticsBadge = `
                                <div class="flex items-center gap-1 mt-2 pt-2 border-t border-slate-100">
                                    <span class="text-xs ${badgeColor} px-2 py-0.5 rounded-full flex items-center gap-1">
                                        ${badgeIcon} ${score}%
                                    </span>
                                    ${stats.weak_topics.length > 0 ? `
                                        <span class="text-xs text-slate-400" title="Weak topics: ${stats.weak_topics.join(', ')}">
                                            <i class="fa-regular fa-lightbulb"></i> ${stats.weak_topics.length}
                                        </span>
                                    ` : ''}
                                    <span class="text-xs text-slate-400 ml-auto" title="${stats.attempts_count} attempts">
                                        <i class="fa-regular fa-clock"></i> ${stats.attempts_count}
                                    </span>
                                </div>
                            `;
                        }
                    } else {
                        analyticsBadge = `
                            <div class="mt-2 pt-2 border-t border-slate-100">
                                <span class="text-xs text-slate-400">📝 Not quizzed yet</span>
                            </div>
                        `;
                    }

                    html += `
                        <div class="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-lg transition-all cursor-pointer relative group"
                             onclick="openSavedGuide('${guide.id}')">
                            <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition flex gap-1">
                                <button onclick="event.stopPropagation(); editGuideTitle('${guide.id}')" 
                                        class="w-7 h-7 bg-white rounded-full shadow-md flex items-center justify-center text-slate-500 hover:text-indigo-600">
                                    <i class="fa-solid fa-pencil text-xs"></i>
                                </button>
                                <button onclick="event.stopPropagation(); confirmDeleteGuide('${guide.id}')" 
                                        class="w-7 h-7 bg-white rounded-full shadow-md flex items-center justify-center text-slate-500 hover:text-red-600">
                                    <i class="fa-solid fa-trash-can text-xs"></i>
                                </button>
                            </div>
                            
                            <div class="flex items-start gap-3">
                                <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                                    <i class="fa-solid fa-book text-white"></i>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <h4 class="font-semibold text-slate-800 mb-1 pr-16 truncate">${guide.title || 'Untitled Guide'}</h4>
                                    
                                    ${guide.course_code ? `
                                        <div class="text-xs text-indigo-600 font-medium mb-1">
                                            <i class="fa-regular fa-hashtag mr-1"></i>${guide.course_code}
                                        </div>
                                    ` : ''}
                                    
                                    ${tagsHtml ? `<div class="flex flex-wrap gap-1 mb-2">${tagsHtml}</div>` : ''}
                                    
                                    <div class="flex items-center justify-between text-xs">
                                        <span class="text-slate-400">
                                            <i class="fa-regular fa-calendar mr-1"></i> ${date}
                                        </span>
                                        <span class="text-indigo-600 opacity-0 group-hover:opacity-100 transition">
                                            Open <i class="fa-solid fa-arrow-right ml-1 text-xs"></i>
                                        </span>
                                    </div>
                                    
                                    ${analyticsBadge}
                                </div>
                            </div>
                        </div>
                    `;
                });

                html += `</div></div>`;
            }

            if (grid) grid.innerHTML = html;
        } else {
            // No guides found
            if (empty) empty.classList.remove('hidden');
            if (count) count.textContent = '0';
        }

    } catch (err) {
        console.error("Error loading guides:", err);
        if (loading) loading.classList.add('hidden');
        if (empty) empty.classList.remove('hidden');
    }
};

// ============================================
// FETCH QUIZ STATS FOR GUIDES
// ============================================
async function fetchQuizStatsForGuides(guides) {
    const token = await window.getAuthToken?.();
    if (!token) return {};

    const stats = {};

    for (const guide of guides) {
        try {
            const response = await fetch(`/api/quiz-stats/${guide.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success && data.stats) {
                stats[guide.id] = data.stats;
            }
        } catch (err) {
            console.log(`Failed to fetch stats for guide ${guide.id}`);
        }
    }

    return stats;
}

window.filterLibrary = function () {
    libraryFilter = document.getElementById('librarySearch')?.value || '';
};

window.clearSearch = function () {
    const search = document.getElementById('librarySearch');
    if (search) search.value = '';
    libraryFilter = '';
};

window.editGuideTitle = async function (id) {
    const guide = userLibrary.find(g => g.id === id);
    if (!guide) return;

    const newTitle = prompt("Enter new title:", guide.title);
    if (!newTitle || newTitle === guide.title) return;

    const token = await window.getAuthToken?.();
    if (!token) return;

    try {
        const response = await fetch(`/api/update-guide/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ title: newTitle })
        });
        const data = await response.json();
        if (data.success) {
            if (window.showToast) window.showToast("Title updated!", "success");
            loadSavedGuides();
        }
    } catch (err) {
        console.error(err);
        if (window.showToast) window.showToast("Failed to update title");
    }
};

window.exportLibrary = function () {
    if (userLibrary.length === 0) {
        if (window.showToast) window.showToast("No guides to export");
        return;
    }

    const exportData = userLibrary.map(guide => ({
        title: guide.title,
        created: guide.created_at,
        content: guide.content.substring(0, 200) + '...'
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'studyforge-library.json';
    a.click();
    URL.revokeObjectURL(url);
    if (window.showToast) window.showToast("Library exported!", "success");
};

// ============================================
// DELETE FUNCTIONS
// ============================================
window.confirmDeleteGuide = function (id) {
    guideToDelete = id;
    const modal = document.getElementById('deleteModal');
    if (modal) modal.classList.remove('hidden');
};

window.closeDeleteModal = function () {
    const modal = document.getElementById('deleteModal');
    if (modal) modal.classList.add('hidden');
    guideToDelete = null;
};

window.deleteGuide = async function () {
    if (!guideToDelete) return;

    const token = await window.getAuthToken?.();
    if (!token) {
        if (window.showToast) window.showToast("Please sign in again");
        closeDeleteModal();
        return;
    }

    try {
        const response = await fetch(`/api/delete-guide/${guideToDelete}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            if (window.showToast) window.showToast("Guide deleted", "success");
            closeDeleteModal();
            loadSavedGuides();
        } else {
            if (window.showToast) window.showToast("Delete failed");
        }
    } catch (err) {
        console.error(err);
        if (window.showToast) window.showToast("Error deleting guide");
    } finally {
        guideToDelete = null;
    }
};

// ============================================
// STUDY MODE (ACTIVE RECALL) FUNCTIONS
// ============================================
window.toggleStudyMode = function () {
    const dropdown = document.getElementById('studyModeOptions');
    if (dropdown) dropdown.classList.toggle('hidden');
};

window.startFlashcardMode = function () {
    console.log("Flashcard mode");
    document.getElementById('studyModeOptions')?.classList.add('hidden');

    if (!fullCourseContext) {
        if (window.showToast) window.showToast("Generate a study guide first");
        return;
    }

    extractFlashcards();

    studyModeData.type = 'flashcard';
    studyModeData.currentIndex = 0;

    document.getElementById('studyModeIcon').textContent = '🃏';
    document.getElementById('studyModeTitleText').textContent = 'Flashcard Mode';
    document.getElementById('studyModeSubtitle').textContent = studyModeData.items.length + ' cards • Click to flip';
    document.getElementById('flashcardUI').classList.remove('hidden');
    document.getElementById('quizUI').classList.add('hidden');

    if (studyModeData.items.length > 0) showCurrentFlashcard();
    openStudyMode();
};

window.startQuizMode = function () {
    console.log("Quiz mode");
    document.getElementById('studyModeOptions')?.classList.add('hidden');

    if (!fullCourseContext) {
        if (window.showToast) window.showToast("Generate a study guide first");
        return;
    }

    quizScore = { correct: 0, total: 0, answers: [] };
    extractQuizQuestions();

    studyModeData.type = 'quiz';
    studyModeData.currentIndex = 0;

    document.getElementById('studyModeIcon').textContent = '❓';
    document.getElementById('studyModeTitleText').textContent = 'Quiz Mode';
    document.getElementById('studyModeSubtitle').textContent = studyModeData.items.length + ' questions • Test yourself';
    document.getElementById('flashcardUI').classList.add('hidden');
    document.getElementById('quizUI').classList.remove('hidden');
    document.getElementById('quizExplanation').classList.add('hidden');

    if (studyModeData.items.length > 0) showCurrentQuizQuestion();
    openStudyMode();
};

function extractFlashcards() {
    const flashcards = [];
    const flashcardSection = fullCourseContext.match(/Flashcards \(Term - Definition\)([\s\S]*?)(?=\n\n\w+|\n*$)/i);

    if (flashcardSection && flashcardSection[1]) {
        const lines = flashcardSection[1].split('\n');
        for (let i = 0; i < lines.length; i++) {
            const match = lines[i].match(/([^-:]+)[-:]\s*(.+)/);
            if (match) flashcards.push({ term: match[1].trim(), definition: match[2].trim() });
        }
    }

    if (flashcards.length === 0) {
        flashcards.push(
            { term: "Active Recall", definition: "A learning technique where you actively retrieve information from memory" },
            { term: "Spaced Repetition", definition: "Reviewing material at increasing intervals over time" },
            { term: "StudyForge", definition: "Your AI-powered study assistant" }
        );
    }

    studyModeData.items = flashcards;
    document.getElementById('cardCounter').textContent = '1 / ' + flashcards.length;
}

function extractQuizQuestions() {
    const questions = [];
    const contentLength = fullCourseContext?.length || 0;
    let targetQuestions = 10;

    if (contentLength < 1000) targetQuestions = 20;
    else if (contentLength < 5000) targetQuestions = 35;
    else if (contentLength < 15000) targetQuestions = 50;
    else targetQuestions = 75;

    console.log(`📊 Content length: ${contentLength} chars → Generating ${targetQuestions} questions`);

    const practiceSection = fullCourseContext.match(/Practice Questions([\s\S]*?)(?=\n\n\w+|\n*$)/i);
    const keyConceptsSection = fullCourseContext.match(/Key Concepts([\s\S]*?)(?=\n\n\w+|\n*$)/i);
    const definitionsSection = fullCourseContext.match(/Key Definitions([\s\S]*?)(?=\n\n\w+|\n*$)/i);

    if (practiceSection && practiceSection[1]) {
        const lines = practiceSection[1].split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim().startsWith('-') || line.trim().match(/^\d+\./)) {
                const questionText = line.replace(/^[-•\d\.]\s*/, '').trim();
                if (questionText.length > 10) {
                    const options = generateOptionsFromContent(questionText, fullCourseContext);
                    questions.push({
                        question: questionText,
                        options: options.options,
                        correct: options.correctIndex,
                        explanation: generateExplanation(questionText, fullCourseContext)
                    });
                }
            }
        }
    }

    // Add from Key Concepts if needed...
    while (questions.length < targetQuestions && keyConceptsSection && keyConceptsSection[1]) {
        const lines = keyConceptsSection[1].split('\n');
        for (let i = 0; i < lines.length && questions.length < targetQuestions; i++) {
            const line = lines[i];
            if (line.trim().startsWith('-')) {
                const concept = line.replace(/^[-•]\s*/, '').trim();
                if (concept.length > 10 && concept.length < 200) {
                    const options = generateOptionsFromContent(concept, fullCourseContext);
                    questions.push({
                        question: `What is ${concept.split(' - ')[0] || concept.substring(0, 50)}?`,
                        options: options.options,
                        correct: options.correctIndex,
                        explanation: concept
                    });
                }
            }
        }
    }

    // Add from Definitions if needed...
    while (questions.length < targetQuestions && definitionsSection && definitionsSection[1]) {
        const lines = definitionsSection[1].split('\n');
        for (let i = 0; i < lines.length && questions.length < targetQuestions; i++) {
            const line = lines[i];
            if (line.includes(':')) {
                const [term, definition] = line.split(':');
                if (term && definition) {
                    const options = generateOptionsFromContent(definition.trim(), fullCourseContext);
                    questions.push({
                        question: `Define: ${term.trim()}`,
                        options: options.options,
                        correct: options.correctIndex,
                        explanation: definition.trim()
                    });
                }
            }
        }
    }

    // Add from sentences as last resort...
    while (questions.length < targetQuestions) {
        const sentences = fullCourseContext.split(/[.!?]\s+/).filter(s => s.length > 30 && s.length < 200);
        for (let i = 0; i < sentences.length && questions.length < targetQuestions; i++) {
            const sentence = sentences[i];
            const options = generateOptionsFromContent(sentence, fullCourseContext);
            questions.push({
                question: sentence.length > 100 ? sentence.substring(0, 100) + "..." : sentence,
                options: options.options,
                correct: options.correctIndex,
                explanation: "Based on your course material."
            });
        }
    }

    studyModeData.items = questions.slice(0, Math.min(targetQuestions, 100));
    document.getElementById('cardCounter').textContent = `1 / ${studyModeData.items.length}`;
    document.getElementById('totalQuestions').textContent = studyModeData.items.length;
    console.log(`✅ Generated ${studyModeData.items.length} quiz questions`);
}

function generateOptionsFromContent(questionText, context) {
    let correctAnswer = "";
    const sentences = context.split(/[.!?]\s+/);

    for (let i = 0; i < sentences.length; i++) {
        if (sentences[i].toLowerCase().includes(questionText.toLowerCase().substring(0, 30))) {
            correctAnswer = sentences[i + 1] || sentences[i];
            break;
        }
    }
    if (!correctAnswer) correctAnswer = sentences[0] || "Based on your course material";
    correctAnswer = correctAnswer.substring(0, 120);

    const distractors = [];
    const otherSentences = sentences.filter(s => !s.includes(questionText.substring(0, 30)) && s.length > 20);

    for (let i = 0; i < 3; i++) {
        if (otherSentences[i]) {
            let distractor = otherSentences[i].substring(0, 100);
            if (distractor !== correctAnswer && !distractors.includes(distractor)) {
                distractors.push(distractor);
            }
        }
    }
    while (distractors.length < 3) distractors.push("This is not mentioned in the material");

    let allOptions = [correctAnswer, ...distractors];
    for (let i = allOptions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
    }

    return { options: allOptions, correctIndex: allOptions.indexOf(correctAnswer) };
}

function generateExplanation(questionText, context) {
    const sentences = context.split(/[.!?]\s+/);
    for (let i = 0; i < sentences.length; i++) {
        if (sentences[i].toLowerCase().includes(questionText.toLowerCase().substring(0, 30))) {
            return sentences[i];
        }
    }
    return "Based on your course material, review the section for more details.";
}

function showCurrentFlashcard() {
    const card = studyModeData.items[studyModeData.currentIndex];
    if (!card) return;

    document.getElementById('cardFront').textContent = card.term;
    document.getElementById('cardBack').textContent = card.definition;
    document.getElementById('cardFront').classList.remove('hidden');
    document.getElementById('cardBack').classList.add('hidden');
    document.getElementById('cardCounter').textContent = (studyModeData.currentIndex + 1) + ' / ' + studyModeData.items.length;
    const progress = ((studyModeData.currentIndex + 1) / studyModeData.items.length) * 100;
    document.getElementById('studyProgressBar').style.width = progress + '%';
}

function showCurrentQuizQuestion() {
    const question = studyModeData.items[studyModeData.currentIndex];
    if (!question) return;

    document.getElementById('quizQuestion').textContent = question.question;
    document.getElementById('currentQuestionNum').textContent = studyModeData.currentIndex + 1;
    document.getElementById('totalQuestions').textContent = studyModeData.items.length;

    const optionsContainer = document.getElementById('quizOptions');
    optionsContainer.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D'];

    for (let i = 0; i < question.options.length; i++) {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'quiz-option p-4 border-2 border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer transition';
        optionDiv.setAttribute('data-option-index', i);
        optionDiv.innerHTML = `<span class="font-semibold mr-2">${letters[i]}.</span> ${question.options[i]}`;
        optionDiv.onclick = () => selectQuizOption(i);
        optionsContainer.appendChild(optionDiv);
    }

    document.getElementById('quizExplanation').classList.add('hidden');
    document.getElementById('cardCounter').textContent = `${studyModeData.currentIndex + 1} / ${studyModeData.items.length}`;
    const progress = ((studyModeData.currentIndex + 1) / studyModeData.items.length) * 100;
    document.getElementById('studyProgressBar').style.width = progress + '%';
}

window.flipCard = function () {
    const front = document.getElementById('cardFront');
    const back = document.getElementById('cardBack');
    if (front && back) {
        if (front.classList.contains('hidden')) {
            front.classList.remove('hidden');
            back.classList.add('hidden');
        } else {
            front.classList.add('hidden');
            back.classList.remove('hidden');
        }
    }
};

window.selectQuizOption = function (index) {
    const question = studyModeData.items[studyModeData.currentIndex];
    if (!question) return;

    if (quizScore.answers[studyModeData.currentIndex] !== undefined) {
        if (window.showToast) window.showToast("You already answered this question!", "error");
        return;
    }

    const options = document.querySelectorAll('.quiz-option');
    for (let i = 0; i < options.length; i++) {
        options[i].style.pointerEvents = 'none';
        options[i].classList.remove('hover:border-indigo-300', 'hover:bg-indigo-50');
    }

    for (let i = 0; i < options.length; i++) {
        options[i].classList.remove('border-indigo-600', 'bg-indigo-50', 'border-green-500', 'bg-green-50', 'border-red-500', 'bg-red-50');
    }

    const selected = options[index];
    selected.classList.add('border-indigo-600', 'bg-indigo-50');

    const isCorrect = (index === question.correct);
    quizScore.answers[studyModeData.currentIndex] = {
        question: question.question,
        userAnswer: index,
        correctAnswer: question.correct,
        isCorrect: isCorrect,
        explanation: question.explanation
    };

    if (isCorrect) {
        quizScore.correct++;
        selected.classList.remove('border-indigo-600');
        selected.classList.add('border-green-500', 'bg-green-50');
        if (window.showToast) window.showToast("✅ Correct! Great job!", "success");
    } else {
        selected.classList.add('border-red-500', 'bg-red-50');
        const correct = options[question.correct];
        correct.classList.add('border-green-500', 'bg-green-50');
        if (window.showToast) window.showToast(`❌ Not quite. The correct answer was ${String.fromCharCode(65 + question.correct)}.`, "error");
    }

    const explanation = document.getElementById('quizExplanation');
    const explanationText = explanation.querySelector('p');
    if (explanationText) {
        explanationText.innerHTML = `<span class="font-bold">📖 Explanation:</span> ${question.explanation || "Review your course material for more details."}`;
    }
    explanation.classList.remove('hidden');

    setTimeout(() => explanation.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
};

window.nextCard = function () {
    if (studyModeData.currentIndex === studyModeData.items.length - 1) {
        const allAnswered = quizScore.answers.length === studyModeData.items.length &&
            quizScore.answers.every(a => a !== undefined);

        if (allAnswered) {
            showQuizResults();
        } else {
            if (window.showToast) window.showToast("Please answer all questions before finishing!", "error");
        }
        return;
    }

    if (studyModeData.currentIndex < studyModeData.items.length - 1) {
        studyModeData.currentIndex++;
        if (studyModeData.type === 'flashcard') showCurrentFlashcard();
        else showCurrentQuizQuestion();
    }
};

window.previousCard = function () {
    if (studyModeData.currentIndex > 0) {
        studyModeData.currentIndex--;
        if (studyModeData.type === 'flashcard') showCurrentFlashcard();
        else showCurrentQuizQuestion();
    }
};

window.markHard = function () { if (window.showToast) window.showToast("📝 Noted! Will show more often.", "success"); };
window.markGood = function () { if (window.showToast) window.showToast("👍 Got it!", "success"); };
window.markEasy = function () { if (window.showToast) window.showToast("⭐ Easy! Will space out.", "success"); };

function openStudyMode() {
    const modal = document.getElementById('studyModeModal');
    if (modal) modal.classList.remove('hidden');
}
window.closeStudyMode = function () {
    const modal = document.getElementById('studyModeModal');
    if (modal) modal.classList.add('hidden');
};

// ============================================
// QUIZ RESULTS SUMMARY
// ============================================
async function saveQuizAttempt() {
    const token = await window.getAuthToken?.();
    if (!token) return;

    const currentGuideId = window.currentGuideId || null;
    const total = studyModeData.items.length;
    const correct = quizScore.correct;
    const percentage = Math.round((correct / total) * 100);

    const weakTopics = [];
    const wrongAnswers = quizScore.answers.filter(a => a && !a.isCorrect);
    wrongAnswers.forEach(answer => weakTopics.push(answer.question.substring(0, 60)));

    const attemptData = {
        score: correct,
        total_questions: total,
        percentage: percentage,
        answers: {
            correct_count: correct,
            wrong_count: total - correct,
            weak_topics: weakTopics.slice(0, 5),
            answers: quizScore.answers
        }
    };

    try {
        const response = await fetch('/api/save-quiz-attempt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                guide_id: currentGuideId,
                score: correct,
                total_questions: total,
                percentage: percentage,
                answers: attemptData.answers
            })
        });
        const data = await response.json();
        if (data.success) console.log("✅ Quiz attempt saved");
    } catch (err) {
        console.error("Error saving quiz attempt:", err);
    }
}

function showQuizResults() {
    saveQuizAttempt();

    const total = studyModeData.items.length;
    const correct = quizScore.correct;
    const percentage = Math.round((correct / total) * 100);

    let grade = '', gradeColor = '', gradeIcon = '';
    if (percentage >= 90) { grade = 'Excellent!'; gradeColor = 'text-emerald-600'; gradeIcon = '🏆'; }
    else if (percentage >= 75) { grade = 'Great Job!'; gradeColor = 'text-blue-600'; gradeIcon = '🎉'; }
    else if (percentage >= 60) { grade = 'Good Effort!'; gradeColor = 'text-amber-600'; gradeIcon = '📚'; }
    else if (percentage >= 40) { grade = 'Keep Studying!'; gradeColor = 'text-orange-600'; gradeIcon = '📖'; }
    else { grade = 'Need More Practice'; gradeColor = 'text-red-600'; gradeIcon = '💪'; }

    const resultsHtml = `
        <div class="bg-white rounded-2xl p-6 shadow-lg">
            <div class="text-center mb-6">
                <div class="text-6xl mb-3">${gradeIcon}</div>
                <h2 class="text-2xl font-bold text-slate-800">Quiz Complete!</h2>
                <p class="text-slate-500 mt-1">Here's how you did</p>
            </div>
            <div class="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-6 mb-6">
                <div class="flex items-center justify-between mb-4">
                    <span class="text-slate-600">Your Score</span>
                    <span class="text-3xl font-bold text-indigo-600">${percentage}%</span>
                </div>
                <div class="w-full bg-slate-200 rounded-full h-3 mb-4">
                    <div class="bg-gradient-to-r from-indigo-600 to-purple-600 h-3 rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
                </div>
                <div class="flex justify-between text-sm text-slate-500">
                    <span>✅ Correct: ${correct}</span>
                    <span>❌ Incorrect: ${total - correct}</span>
                    <span>📊 Total: ${total}</span>
                </div>
            </div>
            <div class="mb-6">
                <h3 class="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <i class="fa-regular fa-chart-line"></i> Grade: <span class="${gradeColor} font-bold">${grade}</span>
                </h3>
                <p class="text-sm text-slate-500">${getFeedbackMessage(percentage)}</p>
            </div>
            <div class="border-t border-slate-200 pt-4 mb-4">
                <details class="cursor-pointer">
                    <summary class="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-2">
                        <i class="fa-regular fa-list-tree"></i> Review Your Answers (${total} questions)
                    </summary>
                    <div class="mt-4 space-y-3 max-h-96 overflow-y-auto">${generateAnswersReview()}</div>
                </details>
            </div>
            <div class="flex gap-3">
                <button onclick="closeStudyMode()" class="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 font-semibold transition">Close</button>
                <button onclick="resetAndRetakeQuiz()" class="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition"><i class="fa-solid fa-rotate-right mr-1"></i> Retake Quiz</button>
            </div>
        </div>
    `;

    const studyContent = document.getElementById('studyContent');
    if (studyContent) studyContent.innerHTML = resultsHtml;
    document.getElementById('studyProgressBar').style.width = '100%';
    if (percentage >= 70 && document.getElementById('successSound')) document.getElementById('successSound').play().catch(() => { });
}

function getFeedbackMessage(percentage) {
    if (percentage >= 90) return "Outstanding! You've mastered this material. Time to move on to the next topic! 🚀";
    if (percentage >= 75) return "Great work! You have a solid understanding. Review the questions you missed to perfect your knowledge. 📚";
    if (percentage >= 60) return "Good effort! You're on the right track. Focus on the topics you got wrong and try again. 💪";
    if (percentage >= 40) return "Keep going! Review the material and retake the quiz to improve your score. Every attempt makes you stronger. 📖";
    return "Don't give up! Go back to your study guide, review the key concepts, and try the quiz again. You've got this! 🔥";
}

function generateAnswersReview() {
    let html = '';
    const letters = ['A', 'B', 'C', 'D'];
    for (let i = 0; i < quizScore.answers.length; i++) {
        const answer = quizScore.answers[i];
        if (!answer) continue;
        const isCorrect = answer.isCorrect;
        const userLetter = letters[answer.userAnswer];
        const correctLetter = letters[answer.correctAnswer];
        html += `
            <div class="bg-slate-50 rounded-xl p-3 border ${isCorrect ? 'border-green-200' : 'border-red-200'}">
                <div class="flex items-start gap-3">
                    <div class="flex-shrink-0">${isCorrect ? '<i class="fa-regular fa-circle-check text-green-500"></i>' : '<i class="fa-regular fa-circle-xmark text-red-500"></i>'}</div>
                    <div class="flex-1">
                        <p class="text-sm font-medium text-slate-700 mb-1">Q${i + 1}: ${answer.question.substring(0, 100)}${answer.question.length > 100 ? '...' : ''}</p>
                        <p class="text-xs ${isCorrect ? 'text-green-600' : 'text-red-600'}">Your answer: ${userLetter}. ${studyModeData.items[i]?.options[answer.userAnswer]?.substring(0, 80) || 'N/A'}</p>
                        ${!isCorrect ? `<p class="text-xs text-green-600 mt-1">Correct: ${correctLetter}. ${studyModeData.items[i]?.options[answer.correctAnswer]?.substring(0, 80)}</p>` : ''}
                        <p class="text-xs text-slate-400 mt-1">${answer.explanation?.substring(0, 100)}${answer.explanation?.length > 100 ? '...' : ''}</p>
                    </div>
                </div>
            </div>
        `;
    }
    return html;
}

function resetAndRetakeQuiz() {
    quizScore = { correct: 0, total: 0, answers: [] };
    studyModeData.currentIndex = 0;
    const studyContent = document.getElementById('studyContent');
    if (studyContent) {
        studyContent.innerHTML = `
            <div id="quizUI" class="w-full">
                <div class="bg-white rounded-2xl shadow-xl p-6 mb-4">
                    <p class="text-xs text-indigo-600 font-semibold mb-2">QUESTION <span id="currentQuestionNum">1</span> OF <span id="totalQuestions">10</span></p>
                    <h3 id="quizQuestion" class="text-xl text-slate-800 font-medium mb-6">Loading questions...</h3>
                    <div id="quizOptions" class="space-y-3"></div>
                </div>
                <div id="quizExplanation" class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4 hidden">
                    <p class="text-sm text-emerald-700"><span class="font-bold">Explanation:</span> Explanation will appear here</p>
                </div>
            </div>
        `;
        showCurrentQuizQuestion();
    }
    document.getElementById('cardCounter').textContent = `1 / ${studyModeData.items.length}`;
    document.getElementById('studyProgressBar').style.width = `${(1 / studyModeData.items.length) * 100}%`;
    if (window.showToast) window.showToast("Quiz reset! Try again!", "success");
}

// ============================================
// AUTO-SAVE INDICATOR
// ============================================
function showAutoSaveIndicator() {
    const indicator = document.getElementById('autoSaveIndicator');
    const timeSpan = document.getElementById('autoSaveTime');
    if (!indicator || !timeSpan) return;

    if (lastSaveTime) {
        const secondsAgo = Math.floor((Date.now() - lastSaveTime) / 1000);
        if (secondsAgo < 60) timeSpan.innerHTML = `Saved • ${secondsAgo} ${secondsAgo === 1 ? 'second' : 'seconds'} ago`;
        else timeSpan.innerHTML = `Saved • ${Math.floor(secondsAgo / 60)} minutes ago`;
    } else timeSpan.innerHTML = 'Saved';

    indicator.classList.remove('hidden');
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => indicator.classList.add('hidden'), 3000);
}

function updateAutoSaveIndicator() {
    lastSaveTime = Date.now();
    showAutoSaveIndicator();
}

// ============================================
// FILE UPLOAD HANDLER
// ============================================
function initFileUpload() {
    const fileUpload = document.getElementById('fileUpload');
    if (!fileUpload) return;

    fileUpload.addEventListener('change', async function (e) {
        const file = e.target.files[0];
        if (!file) return;

        const isAuthenticated = await window.requireAuth?.();
        if (!isAuthenticated) {
            e.target.value = '';
            return;
        }

        const label = document.querySelector('label[for="fileUpload"]');
        const originalText = label ? label.innerHTML : '';

        if (label) {
            label.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Uploading...';
            label.style.pointerEvents = 'none';
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            const token = await window.getAuthToken?.();
            if (!token) {
                if (window.showToast) window.showToast("Please sign in again");
                return;
            }

            const response = await fetch('/api/upload-file', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const data = await response.json();

            if (data.success && data.text) {
                document.getElementById('courseInput').value = data.text;
                if (data.language) {
                    currentDetectedLanguage = data.language;
                    console.log("📝 Detected language from file:", currentDetectedLanguage);
                    if (window.showToast) window.showToast(`✅ File uploaded! Language detected: ${currentDetectedLanguage.toUpperCase()}`, "success");
                } else {
                    if (window.showToast) window.showToast(`✅ File uploaded! ${data.text.length} characters extracted.`, "success");
                }
            } else {
                if (window.showToast) window.showToast(data.error || "Failed to extract text");
            }
        } catch (err) {
            console.error(err);
            if (window.showToast) window.showToast("Upload failed");
        } finally {
            e.target.value = '';
            if (label) {
                label.innerHTML = originalText;
                label.style.pointerEvents = 'auto';
            }
        }
    });
}

// ============================================
// LOAD PROFILE DATA INTO ACCOUNT SECTION
// ============================================
async function loadProfileData() {
    console.log("👤 Loading profile data...");

    const supabase = getSupabase();
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Set name and email
    const nameInput = document.getElementById('profileName');
    const emailInput = document.getElementById('profileEmail');

    if (nameInput) nameInput.value = user.user_metadata?.full_name || '';
    if (emailInput) emailInput.value = user.email || '';

    // Check if user is Pro first
    const token = await window.getAuthToken?.();
    if (token) {
        try {
            const accountRes = await fetch('/api/account', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const accountData = await accountRes.json();
            const isPro = accountData.success && accountData.plan === "pro";

            const usageSpan = document.getElementById('accountUsageDisplay');
            if (usageSpan) {
                if (isPro) {
                    usageSpan.innerHTML = '♾️ Unlimited';
                } else {
                    // Load usage for free users
                    const usageRes = await fetch('/api/usage', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const usageData = await usageRes.json();
                    if (usageData.success) {
                        usageSpan.innerHTML = `${usageData.used}/5 used today`;
                    }
                }
            }
        } catch (err) {
            console.error("Error loading usage:", err);
        }
    }

    // Load account info for plan and expiry
    if (window.loadAccountInfo) window.loadAccountInfo();
}

// ============================================
// PROGRESS TRACKING SYSTEM
// ============================================
async function loadProgressStats() {
    console.log("Loading progress stats...");
    const token = await window.getAuthToken?.();
    if (!token) return;

    try {
        const guidesResponse = await fetch("/api/my-guides", { headers: { "Authorization": `Bearer ${token}` } });
        const guidesData = await guidesResponse.json();
        const lecturesCount = guidesData.success ? guidesData.guides.length : 0;

        let flashcardsCount = 0, questionsCount = 0;
        if (guidesData.success && guidesData.guides.length > 0) {
            guidesData.guides.forEach(guide => {
                const content = guide.content || '';
                const flashcardMatches = content.match(/Term \d+ -/g);
                if (flashcardMatches) flashcardsCount += flashcardMatches.length;
                const questionMatches = content.match(/- Question \d+/g);
                if (questionMatches) questionsCount += questionMatches.length;
            });
        }

        let streak = 1;
        if (guidesData.success && guidesData.guides.length > 0) {
            const firstGuide = new Date(guidesData.guides[guidesData.guides.length - 1].created_at);
            const today = new Date();
            const daysSince = Math.floor((today - firstGuide) / (1000 * 60 * 60 * 24));
            streak = Math.min(daysSince + 1, 7);
        }

        const timeSaved = (lecturesCount * 0.5).toFixed(1);

        document.getElementById('lecturesSaved').textContent = lecturesCount;
        document.getElementById('flashcardsReviewed').textContent = flashcardsCount || lecturesCount * 5;
        document.getElementById('questionsAnswered').textContent = questionsCount || lecturesCount * 3;
        document.getElementById('currentStreak').textContent = streak;
        document.getElementById('timeSaved').textContent = timeSaved + 'h';

        if (guidesData.success && guidesData.guides.length > 0) updateHeatmap(guidesData.guides);
    } catch (err) {
        console.error("Error loading progress stats:", err);
        document.getElementById('lecturesSaved').textContent = '0';
        document.getElementById('flashcardsReviewed').textContent = '0';
        document.getElementById('questionsAnswered').textContent = '0';
        document.getElementById('currentStreak').textContent = '1';
        document.getElementById('timeSaved').textContent = '0h';
    }
}

function updateHeatmap(guides) {
    const heatmapBars = document.querySelectorAll('.progress-heatmap-bar');
    if (!heatmapBars.length) return;

    const dayCount = [0, 0, 0, 0, 0, 0, 0];
    guides.forEach(guide => {
        const date = new Date(guide.created_at);
        dayCount[date.getDay()]++;
    });

    const max = Math.max(...dayCount, 1);
    const days = [0, 1, 2, 3, 4, 5, 6];
    days.forEach((day, index) => {
        if (heatmapBars[index]) heatmapBars[index].style.width = (dayCount[day] / max) * 100 + '%';
    });

    let bestDay = 0, bestCount = 0;
    dayCount.forEach((count, day) => { if (count > bestCount) { bestCount = count; bestDay = day; } });
    const bestDayElement = document.querySelector('.best-day-text');
    if (bestDayElement) bestDayElement.textContent = `Best day: ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][bestDay]}`;
}

window.loadProgressStats = loadProgressStats;
window.updateProgressAfterGeneration = function () { setTimeout(loadProgressStats, 1000); };

// ============================================
// LAST GENERATED HISTORY
// ============================================
function saveLastGeneratedGuide(title, id) {
    localStorage.setItem('lastGeneratedGuide', JSON.stringify({ title, id, timestamp: Date.now() }));
    updateLastGeneratedDisplay();
}

function updateLastGeneratedDisplay() {
    const container = document.getElementById('lastGeneratedContainer');
    const link = document.getElementById('lastGeneratedLink');
    if (!container || !link) return;

    const saved = localStorage.getItem('lastGeneratedGuide');
    if (!saved) { container.classList.add('hidden'); return; }

    try {
        const lastGuide = JSON.parse(saved);
        const daysOld = (Date.now() - lastGuide.timestamp) / (1000 * 60 * 60 * 24);
        if (daysOld > 7) { localStorage.removeItem('lastGeneratedGuide'); container.classList.add('hidden'); return; }

        let displayTitle = lastGuide.title;
        if (displayTitle.length > 40) displayTitle = displayTitle.substring(0, 37) + '...';
        link.textContent = displayTitle;
        link.onclick = (e) => {
            e.preventDefault();
            const guide = userLibrary.find(g => g.id === lastGuide.id);
            if (guide) openSavedGuide(lastGuide.id);
            else { localStorage.removeItem('lastGeneratedGuide'); container.classList.add('hidden'); if (window.showToast) window.showToast("Guide not found in library", "error"); }
        };
        container.classList.remove('hidden');
    } catch (e) { container.classList.add('hidden'); }
}

function loadLastGenerated() { updateLastGeneratedDisplay(); }

// ============================================
// PRO UPGRADE OVERLAY (Blur Effect)
// ============================================
window.showProUpgradeOverlay = function () {
    const overlay = document.getElementById('proUpgradeOverlay');
    if (!overlay) return;

    const mainContent = document.querySelector('main');
    if (mainContent) mainContent.classList.add('blur-sm');

    overlay.classList.remove('hidden');
    overlay.style.opacity = '0';
    setTimeout(() => overlay.style.opacity = '1', 10);
    document.body.classList.add('overlay-active');
};

window.closeProOverlay = function () {
    const overlay = document.getElementById('proUpgradeOverlay');
    if (!overlay) return;

    const mainContent = document.querySelector('main');
    if (mainContent) mainContent.classList.remove('blur-sm');

    overlay.style.opacity = '0';
    setTimeout(() => overlay.classList.add('hidden'), 300);
    document.body.classList.remove('overlay-active');
};

document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        const overlay = document.getElementById('proUpgradeOverlay');
        if (overlay && !overlay.classList.contains('hidden')) closeProOverlay();
    }
});

document.addEventListener('click', function (e) {
    const overlay = document.getElementById('proUpgradeOverlay');
    if (overlay && !overlay.classList.contains('hidden')) {
        const modal = overlay.querySelector('.bg-white');
        if (modal && !modal.contains(e.target)) closeProOverlay();
    }
});

// ============================================
// KEYBOARD SHORTCUTS
// ============================================
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const cmdKey = isMac ? '⌘' : 'Ctrl';

function showShortcutHint(shortcut, action) { if (window.showToast) window.showToast(`${shortcut} → ${action}`, "success"); }

document.addEventListener('keydown', function (e) {
    const activeElement = document.activeElement;
    const isTyping = activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable;

    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isTyping) {
        e.preventDefault();
        const generateBtn = document.getElementById('condenseBtn');
        if (generateBtn && !generateBtn.disabled) { initiateCondense(); showShortcutHint(`${cmdKey} + Enter`, 'Generate Study Guide'); }
        return;
    }

    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        if (fullCourseContext) { generateExamMode(); showShortcutHint(`${cmdKey} + Shift + E`, 'Exam Mode'); }
        else window.showToast?.("Generate a study guide first", "error");
        return;
    }

    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        toggleStudyMode();
        showShortcutHint(`${cmdKey} + Shift + S`, 'Open Study Mode');
        return;
    }

    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        if (fullCourseContext) { exportToPDF(); showShortcutHint(`${cmdKey} + Shift + P`, 'Export PDF'); }
        else window.showToast?.("Generate a study guide first", "error");
        return;
    }

    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        if (fullCourseContext) { exportToNotion(); showShortcutHint(`${cmdKey} + Shift + C`, 'Copy to Clipboard'); }
        else window.showToast?.("Generate a study guide first", "error");
        return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('librarySearch');
        if (searchInput && !document.getElementById('savedSection').classList.contains('hidden')) {
            searchInput.focus();
            showShortcutHint(`${cmdKey} + K`, 'Search Library');
        } else if (searchInput) {
            showSection('saved');
            setTimeout(() => { searchInput.focus(); showShortcutHint(`${cmdKey} + K`, 'Search Library'); }, 200);
        }
        return;
    }

    if (e.key === '?' && !isTyping) { e.preventDefault(); showShortcutHelp(); return; }
});

function showShortcutHelp() {
    const shortcuts = [
        { keys: `${cmdKey} + Enter`, action: 'Generate Study Guide' },
        { keys: `${cmdKey} + Shift + E`, action: 'Exam Mode' },
        { keys: `${cmdKey} + Shift + S`, action: 'Study Mode' },
        { keys: `${cmdKey} + Shift + P`, action: 'Export PDF' },
        { keys: `${cmdKey} + Shift + C`, action: 'Copy to Clipboard' },
        { keys: `${cmdKey} + K`, action: 'Search Library' },
        { keys: `?`, action: 'Show Shortcuts' }
    ];

    let helpModal = document.getElementById('shortcutHelpModal');
    if (!helpModal) {
        helpModal = document.createElement('div');
        helpModal.id = 'shortcutHelpModal';
        helpModal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[200] hidden';
        helpModal.innerHTML = `
            <div class="bg-white rounded-2xl p-6 max-w-md w-full mx-4 transform transition-all duration-300 scale-95">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-keyboard text-indigo-600"></i> Keyboard Shortcuts</h3>
                    <button onclick="closeShortcutHelp()" class="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center"><i class="fa-solid fa-times text-slate-400"></i></button>
                </div>
                <div class="space-y-3 max-h-96 overflow-y-auto">
                    ${shortcuts.map(s => `<div class="flex justify-between items-center py-2 border-b border-slate-100"><span class="text-sm text-slate-600">${s.action}</span><code class="px-2 py-1 bg-slate-100 rounded text-xs font-mono text-indigo-600">${s.keys}</code></div>`).join('')}
                </div>
                <p class="text-xs text-slate-400 mt-4 text-center">${isMac ? '⌘ = Command' : 'Ctrl = Control'}</p>
            </div>
        `;
        document.body.appendChild(helpModal);
        helpModal.addEventListener('click', (e) => { if (e.target === helpModal) closeShortcutHelp(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && helpModal && !helpModal.classList.contains('hidden')) closeShortcutHelp(); });
    }

    helpModal.classList.remove('hidden');
    gsap.fromTo(helpModal, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    gsap.fromTo(helpModal.firstElementChild, { scale: 0.95, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: "back.out(1.2)" });
}

window.closeShortcutHelp = function () { const modal = document.getElementById('shortcutHelpModal'); if (modal) modal.classList.add('hidden'); };

function addShortcutHint() {
    const footer = document.querySelector('footer');
    if (footer && !document.getElementById('shortcutHintContainer')) {
        const hint = document.createElement('div');
        hint.id = 'shortcutHintContainer';
        hint.className = 'text-center mt-4 text-xs text-slate-400';
        hint.innerHTML = `<i class="fa-regular fa-keyboard mr-1"></i> Press <kbd class="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono">?</kbd> for shortcuts`;
        footer.insertBefore(hint, footer.firstChild);
    }
}

// ============================================
// ANALYTICS DASHBOARD
// ============================================
async function loadAnalytics() {
    console.log("📊 Loading analytics...");

    const token = await window.getAuthToken?.();
    console.log("Token exists:", !!token);

    if (!token) {
        console.log("❌ No auth token, skipping analytics");
        showEmptyAnalytics();
        return;
    }

    try {
        console.log("🔍 Fetching from /api/all-quiz-attempts");
        const response = await fetch('/api/all-quiz-attempts', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log("Response status:", response.status);

        if (!response.ok) {
            console.log("❌ Response not OK:", response.status);
            showEmptyAnalytics();
            return;
        }

        const data = await response.json();
        console.log("📊 Data received:", data);
        console.log("📊 Attempts count:", data.attempts?.length);

        if (!data.success || !data.attempts || data.attempts.length === 0) {
            console.log("📭 No quiz attempts found");
            showEmptyAnalytics();
            return;
        }

        const attempts = data.attempts;
        const guides = userLibrary;

        // Calculate overall stats
        const totalQuizzes = attempts.length;
        const avgScore = Math.round(attempts.reduce((sum, a) => sum + a.percentage, 0) / totalQuizzes);

        // Calculate mastery rate (guides with at least one 70%+ score)
        const masteredGuides = new Set();
        attempts.forEach(a => {
            if (a.percentage >= 70) masteredGuides.add(a.guide_id);
        });
        const masteryRate = guides.length > 0 ? Math.round((masteredGuides.size / guides.length) * 100) : 0;

        // Collect weak topics
        const weakTopicsSet = new Set();
        attempts.forEach(a => {
            if (a.answers && a.answers.weak_topics) {
                a.answers.weak_topics.forEach(t => weakTopicsSet.add(t));
            }
        });

        // Update stats cards
        document.getElementById('avgScore').textContent = `${avgScore}%`;
        document.getElementById('totalQuizzes').textContent = totalQuizzes;
        document.getElementById('masteryRate').textContent = `${masteryRate}%`;
        document.getElementById('weakTopicsCount').textContent = weakTopicsSet.size;

        // Subject breakdown
        const subjectScores = {};
        guides.forEach(guide => {
            const subject = guide.subject || 'Uncategorized';
            const guideAttempts = attempts.filter(a => a.guide_id === guide.id);
            if (guideAttempts.length > 0) {
                const bestScore = Math.max(...guideAttempts.map(a => a.percentage));
                if (!subjectScores[subject]) {
                    subjectScores[subject] = { total: 0, count: 0, best: 0 };
                }
                subjectScores[subject].total += bestScore;
                subjectScores[subject].count++;
                subjectScores[subject].best = Math.max(subjectScores[subject].best, bestScore);
            }
        });

        let subjectHtml = '';
        for (const [subject, scores] of Object.entries(subjectScores)) {
            const avg = Math.round(scores.total / scores.count);
            let colorClass = '';
            if (avg >= 80) colorClass = 'bg-emerald-100 text-emerald-700';
            else if (avg >= 60) colorClass = 'bg-blue-100 text-blue-700';
            else if (avg >= 40) colorClass = 'bg-amber-100 text-amber-700';
            else colorClass = 'bg-red-100 text-red-700';

            subjectHtml += `
                <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-slate-700">${subject}</span>
                    <div class="flex items-center gap-3">
                        <div class="w-32 bg-slate-200 rounded-full h-2">
                            <div class="h-2 rounded-full bg-indigo-600" style="width: ${avg}%"></div>
                        </div>
                        <span class="text-xs font-semibold ${colorClass} px-2 py-0.5 rounded-full">${avg}%</span>
                    </div>
                </div>
            `;
        }

        if (subjectHtml === '') {
            subjectHtml = '<p class="text-slate-500 text-sm">Take quizzes to see subject breakdown</p>';
        }
        document.getElementById('subjectBreakdown').innerHTML = subjectHtml;

        // Recent performance (last 5 attempts)
        const recentAttempts = [...attempts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
        let recentHtml = '';
        recentAttempts.forEach(attempt => {
            const guide = guides.find(g => g.id === attempt.guide_id);
            const date = new Date(attempt.created_at).toLocaleDateString();
            let colorClass = '';
            if (attempt.percentage >= 80) colorClass = 'text-emerald-600';
            else if (attempt.percentage >= 60) colorClass = 'text-blue-600';
            else if (attempt.percentage >= 40) colorClass = 'text-amber-600';
            else colorClass = 'text-red-600';

            recentHtml += `
                <div class="flex items-center justify-between py-2 border-b border-slate-100">
                    <div class="flex-1">
                        <p class="text-sm font-medium text-slate-800 truncate">${guide?.title || 'Unknown Guide'}</p>
                        <p class="text-xs text-slate-400">${date}</p>
                    </div>
                    <div class="text-right">
                        <span class="text-lg font-bold ${colorClass}">${attempt.percentage}%</span>
                        <div class="w-16 bg-slate-200 rounded-full h-1.5 mt-1">
                            <div class="h-1.5 rounded-full bg-indigo-600" style="width: ${attempt.percentage}%"></div>
                        </div>
                    </div>
                </div>
            `;
        });
        document.getElementById('recentPerformance').innerHTML = recentHtml;

        // Recommendations (weak topics and low-score guides)
        const weakGuides = [];
        attempts.forEach(a => {
            if (a.percentage < 60 && a.guide_id) {
                const guide = guides.find(g => g.id === a.guide_id);
                if (guide && !weakGuides.includes(guide)) weakGuides.push(guide);
            }
        });

        const weakTopicsList = Array.from(weakTopicsSet).slice(0, 5);

        let recHtml = '';
        if (weakGuides.length > 0) {
            recHtml += `<p class="text-sm text-amber-700"><i class="fa-regular fa-circle-exclamation mr-1"></i> Review these guides:</p>`;
            weakGuides.slice(0, 3).forEach(guide => {
                recHtml += `<p class="text-sm text-slate-600 ml-4">• ${guide.title}</p>`;
            });
        }
        if (weakTopicsList.length > 0) {
            recHtml += `<p class="text-sm text-amber-700 mt-2"><i class="fa-regular fa-lightbulb mr-1"></i> Focus on these topics:</p>`;
            weakTopicsList.forEach(topic => {
                recHtml += `<p class="text-sm text-slate-600 ml-4">• ${topic.substring(0, 50)}${topic.length > 50 ? '...' : ''}</p>`;
            });
        }
        if (recHtml === '') {
            recHtml = '<p class="text-sm text-emerald-700">🎉 Great job! Keep up the good work!</p>';
        }
        document.getElementById('recommendations').innerHTML = recHtml;

    } catch (err) {
        console.error("Error loading analytics:", err);
        showEmptyAnalytics();
    }
}

function showEmptyAnalytics() {
    document.getElementById('avgScore').textContent = '--';
    document.getElementById('totalQuizzes').textContent = '0';
    document.getElementById('masteryRate').textContent = '0%';
    document.getElementById('weakTopicsCount').textContent = '0';
    document.getElementById('subjectBreakdown').innerHTML = '<p class="text-slate-500 text-sm">Take a quiz to see your stats!</p>';
    document.getElementById('recentPerformance').innerHTML = '<p class="text-slate-500 text-sm">No quiz attempts yet. Start studying!</p>';
    document.getElementById('recommendations').innerHTML = '<p class="text-sm text-slate-500">📝 Take your first quiz to get personalized recommendations!</p>';
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', function () {
    console.log("DOM ready");

    const chatInput = document.getElementById('chatInput');
    if (chatInput) chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChatMessage(); });

    initFileUpload();

    setTimeout(function () {
        const supabase = getSupabase();
        if (!supabase) { console.log("Supabase not ready"); return; }
        supabase.auth.getSession().then(result => { if (!result.data.session) window.location.href = "/"; }).catch(err => console.error("Auth error:", err));
    }, 500);

    loadLastGenerated();
    loadProgressStats();
    setTimeout(addShortcutHint, 1000);

    //Initialize timer
    initTimer();
});

// Add page load transition
document.addEventListener('DOMContentLoaded', function () {
    // Add fade-in to main content on page load
    const mainContent = document.querySelector('main');
    if (mainContent) {
        mainContent.style.animation = 'pageFadeIn 0.4s ease-out';
        setTimeout(() => {
            mainContent.style.animation = '';
        }, 500);
    }
});

// ============================================
// STUDY TIMER (POMODORO) - ENHANCED VERSION
// ============================================

let timerInterval = null;
let timerSeconds = 25 * 60;
let timerRunning = false;
let currentMode = 'focus';
let sessionsCompleted = 0;
let todayFocusMinutes = 0;
let focusStreak = 1;
let autoStart = false;
let currentDuration = 25;
let ambientPlaying = false;
let currentAmbient = 'lofi';

// ============================================
// AMBIENT SOUNDS - BROWSER GENERATED (NO EXTERNAL FILES)
// ============================================

let ambientContext = null;
let ambientSource = null;
let ambientGain = null;

// Create audio context (starts suspended until user interacts)
function getAudioContext() {
    if (!ambientContext) {
        ambientContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return ambientContext;
}

// Generate white noise
function generateWhiteNoise(duration) {
    const ctx = getAudioContext();
    const sampleRate = ctx.sampleRate;
    const samples = duration * sampleRate;
    const buffer = ctx.createBuffer(1, samples, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < samples; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    return buffer;
}

// Generate brown noise (deeper, more soothing)
function generateBrownNoise(duration) {
    const ctx = getAudioContext();
    const sampleRate = ctx.sampleRate;
    const samples = duration * sampleRate;
    const buffer = ctx.createBuffer(1, samples, sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0;
    for (let i = 0; i < samples; i++) {
        const white = Math.random() * 2 - 1;
        const brown = (lastOut + (0.02 * white)) / 1.02;
        data[i] = brown * 0.5;
        lastOut = brown;
    }
    return buffer;
}

// Generate rain-like sound
function generateRainSound(duration) {
    const ctx = getAudioContext();
    const sampleRate = ctx.sampleRate;
    const samples = duration * sampleRate;
    const buffer = ctx.createBuffer(1, samples, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < samples; i++) {
        if (Math.random() < 0.05) {
            data[i] = (Math.random() - 0.5) * 0.8;
        } else {
            data[i] = data[i - 1] * 0.95 || 0;
        }
    }
    return buffer;
}

// Generate lo-fi style
function generateLofiSound(duration) {
    const ctx = getAudioContext();
    const sampleRate = ctx.sampleRate;
    const samples = duration * sampleRate;
    const buffer = ctx.createBuffer(1, samples, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < samples; i++) {
        let value = Math.random() * 0.2 - 0.1;
        if (Math.random() < 0.01) {
            value += Math.random() * 0.1;
        }
        const t = i / sampleRate;
        value += Math.sin(t * 2 * Math.PI * 440) * 0.03;
        value += Math.sin(t * 2 * Math.PI * 880) * 0.02;
        data[i] = Math.max(-0.5, Math.min(0.5, value));
    }
    return buffer;
}

// Generate cafe ambience
function generateCafeSound(duration) {
    const ctx = getAudioContext();
    const sampleRate = ctx.sampleRate;
    const samples = duration * sampleRate;
    const buffer = ctx.createBuffer(1, samples, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < samples; i++) {
        let value = Math.random() * 0.15 - 0.075;
        if (Math.random() < 0.002) {
            value += Math.random() * 0.2;
        }
        const t = i / sampleRate;
        value += Math.sin(t * 2 * Math.PI * 60) * 0.02;
        data[i] = Math.max(-0.3, Math.min(0.3, value));
    }
    return buffer;
}

// Generate nature sounds
function generateNatureSound(duration) {
    const ctx = getAudioContext();
    const sampleRate = ctx.sampleRate;
    const samples = duration * sampleRate;
    const buffer = ctx.createBuffer(1, samples, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < samples; i++) {
        let value = Math.random() * 0.2 - 0.1;
        const t = i / sampleRate;
        if (Math.random() < 0.005) {
            const chirp = Math.sin(t * 2 * Math.PI * 2000) * 0.15;
            value += chirp * (1 - (Math.random() * 0.5));
        }
        data[i] = Math.max(-0.4, Math.min(0.4, value));
    }
    return buffer;
}

// Generate sound based on type
function generateAmbientSound(type, duration = 10) {
    switch (type) {
        case 'whiteNoise':
            return generateWhiteNoise(duration);
        case 'brownNoise':
            return generateBrownNoise(duration);
        case 'rain':
            return generateRainSound(duration);
        case 'lofi':
            return generateLofiSound(duration);
        case 'cafe':
            return generateCafeSound(duration);
        case 'nature':
            return generateNatureSound(duration);
        default:
            return generateBrownNoise(duration);
    }
}

// Play ambient sound
window.playAmbientSound = function () {
    const select = document.getElementById('ambientSelect');
    if (!select) return;

    const selectedType = select.value;

    if (selectedType === 'off') {
        if (ambientSource) {
            try {
                ambientSource.stop();
                ambientSource.disconnect();
            } catch (e) { }
            ambientSource = null;
        }
        ambientPlaying = false;
        if (window.showToast) window.showToast("🔇 Ambient sound off", "success");
        return;
    }

    // Stop current if playing
    if (ambientSource) {
        try {
            ambientSource.stop();
            ambientSource.disconnect();
        } catch (e) { }
        ambientSource = null;
    }

    try {
        const ctx = getAudioContext();
        const buffer = generateAmbientSound(selectedType, 30);

        ambientSource = ctx.createBufferSource();
        ambientSource.buffer = buffer;
        ambientSource.loop = true;

        ambientGain = ctx.createGain();
        ambientGain.gain.value = 0.2;

        ambientSource.connect(ambientGain);
        ambientGain.connect(ctx.destination);

        if (ctx.state === 'suspended') {
            ctx.resume().then(() => {
                ambientSource.start();
                ambientPlaying = true;
                currentAmbient = selectedType;
                if (window.showToast) window.showToast(`🎧 Playing ${selectedType} sounds`, "success");
                localStorage.setItem('ambientType', selectedType);
                localStorage.setItem('ambientPlaying', 'true');
            });
        } else {
            ambientSource.start();
            ambientPlaying = true;
            currentAmbient = selectedType;
            if (window.showToast) window.showToast(`🎧 Playing ${selectedType} sounds`, "success");
            localStorage.setItem('ambientType', selectedType);
            localStorage.setItem('ambientPlaying', 'true');
        }

    } catch (err) {
        console.error('Ambient sound error:', err);
        if (window.showToast) window.showToast("⚠️ Click anywhere on the page first, then try again.", "error");
    }
};

// Change ambient type
window.changeAmbientSound = function () {
    if (ambientPlaying) {
        playAmbientSound();
    }
};

// Stop ambient sound
window.stopAmbientSound = function () {
    if (ambientSource) {
        try {
            ambientSource.stop();
            ambientSource.disconnect();
        } catch (e) { }
        ambientSource = null;
    }
    ambientPlaying = false;
    localStorage.setItem('ambientPlaying', 'false');
    if (window.showToast) window.showToast("🔇 Ambient sound stopped", "success");
};

// Load saved ambient settings
function loadAmbientSettings() {
    const savedAmbient = localStorage.getItem('ambientType');
    const savedPlaying = localStorage.getItem('ambientPlaying');

    if (savedAmbient && savedAmbient !== 'off') {
        const select = document.getElementById('ambientSelect');
        if (select) select.value = savedAmbient;

        if (savedPlaying === 'true') {
            if (window.showToast) window.showToast("🎧 Click Play to start ambient sounds", "success");
        }
    }

    // Add click listener to initialize audio context on first user interaction
    const initAudio = function () {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') {
            ctx.resume().then(() => {
                console.log('Audio context resumed');
                document.removeEventListener('click', initAudio);
                document.removeEventListener('keydown', initAudio);
            });
        }
    };
    document.addEventListener('click', initAudio);
    document.addEventListener('keydown', initAudio);
}

// Sound effects
function playTimerEndSound() {
    const sound = document.getElementById('timerSound');
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(() => console.log('Sound play failed'));
    }
}

// Toggle auto-start
function toggleAutoStart() {
    autoStart = !autoStart;
    document.getElementById('autoStartText').innerHTML = autoStart ? 'Auto On' : 'Auto';
    document.getElementById('autoStartBtn').classList.toggle('bg-indigo-100', autoStart);
    document.getElementById('autoStartBtn').classList.toggle('text-indigo-700', autoStart);
    localStorage.setItem('timerAutoStart', autoStart);
}

// Set custom duration
window.setCustomDuration = function (minutes) {
    if (timerRunning) {
        pauseTimer();
    }
    currentDuration = minutes;
    currentMode = 'focus';
    timerSeconds = minutes * 60;
    updateTimerDisplay();

    document.querySelectorAll('.duration-btn').forEach(btn => {
        btn.classList.remove('bg-indigo-100', 'text-indigo-700');
        btn.classList.add('bg-slate-100');
    });
    if (event && event.target) {
        event.target.classList.remove('bg-slate-100');
        event.target.classList.add('bg-indigo-100', 'text-indigo-700');
    }

    document.getElementById('timerStatus').innerHTML = `${minutes} min focus mode 🎯`;
    localStorage.setItem('timerDuration', minutes);
};

// Load saved timer data
function loadTimerData() {
    const savedSessions = localStorage.getItem('timerSessions');
    const savedFocus = localStorage.getItem('todayFocusMinutes');
    const savedStreak = localStorage.getItem('focusStreak');
    const lastDate = localStorage.getItem('lastFocusDate');
    const savedDuration = localStorage.getItem('timerDuration');
    const savedAutoStart = localStorage.getItem('timerAutoStart');

    if (savedDuration) {
        currentDuration = parseInt(savedDuration);
        timerSeconds = currentDuration * 60;
        updateTimerDisplay();
    }

    if (savedAutoStart === 'true') {
        autoStart = true;
        document.getElementById('autoStartText').innerHTML = 'Auto On';
        document.getElementById('autoStartBtn').classList.add('bg-indigo-100', 'text-indigo-700');
    }

    const today = new Date().toDateString();

    if (lastDate !== today) {
        localStorage.setItem('todayFocusMinutes', '0');
        localStorage.setItem('lastFocusDate', today);
        todayFocusMinutes = 0;

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (lastDate === yesterday.toDateString()) {
            focusStreak = parseInt(savedStreak) || 1;
        } else {
            focusStreak = 1;
            localStorage.setItem('focusStreak', '1');
        }
    } else {
        todayFocusMinutes = parseInt(savedFocus) || 0;
        focusStreak = parseInt(savedStreak) || 1;
    }

    sessionsCompleted = parseInt(savedSessions) || 0;
    updateSessionCounter();
    updateTimerStats();
}

// Update session counter
function updateSessionCounter() {
    const sessionNum = (sessionsCompleted % 4) + 1;
    const counter = document.getElementById('sessionCounter');
    if (counter) counter.innerHTML = `Session ${sessionNum}/4`;
}

// Update timer stats display
function updateTimerStats() {
    const todayEl = document.getElementById('todayFocus');
    const streakEl = document.getElementById('focusStreak');
    if (todayEl) todayEl.innerText = todayFocusMinutes;
    if (streakEl) streakEl.innerText = focusStreak;
}

// Update timer display
function updateTimerDisplay() {
    const minutes = Math.floor(timerSeconds / 60);
    const seconds = timerSeconds % 60;
    const display = document.getElementById('timerDisplay');
    if (display) display.innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Play notification
function playNotification() {
    playTimerEndSound();

    if (Notification.permission === 'granted') {
        new Notification('StudyForge Timer', {
            body: currentMode === 'focus' ? 'Focus session complete! Time for a break 🎉' : 'Break over! Ready to focus again? 💪',
            icon: '/favicon-32x32.png'
        });
    }
}

// Complete session
function completeSession() {
    if (currentMode === 'focus') {
        todayFocusMinutes += currentDuration;
        localStorage.setItem('todayFocusMinutes', todayFocusMinutes);
        updateTimerStats();

        const lastDate = localStorage.getItem('lastFocusDate');
        const today = new Date().toDateString();
        if (lastDate !== today) {
            focusStreak++;
            localStorage.setItem('focusStreak', focusStreak);
            localStorage.setItem('lastFocusDate', today);
            updateTimerStats();
        }

        sessionsCompleted++;
        localStorage.setItem('timerSessions', sessionsCompleted);
        updateSessionCounter();

        if (sessionsCompleted % 4 === 0) {
            currentMode = 'longBreak';
            timerSeconds = 15 * 60;
            document.getElementById('timerStatus').innerHTML = 'Long break! 15 minutes 🧘';
        } else {
            currentMode = 'shortBreak';
            timerSeconds = 5 * 60;
            document.getElementById('timerStatus').innerHTML = 'Short break! 5 minutes ☕';
        }
    } else {
        currentMode = 'focus';
        timerSeconds = currentDuration * 60;
        document.getElementById('timerStatus').innerHTML = `Focus time! ${currentDuration} minutes 🎯`;
    }

    updateTimerDisplay();
    playNotification();

    if (autoStart) {
        setTimeout(() => {
            startTimer();
        }, 1000);
    }
}

// Start timer
window.startTimer = function () {
    if (timerRunning) return;

    timerRunning = true;
    const startBtn = document.getElementById('timerStartBtn');
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }

    timerInterval = setInterval(() => {
        if (timerSeconds <= 0) {
            clearInterval(timerInterval);
            timerRunning = false;

            if (startBtn) {
                startBtn.disabled = false;
                startBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }

            completeSession();
            return;
        }

        timerSeconds--;
        updateTimerDisplay();
    }, 1000);

    const statusEl = document.getElementById('timerStatus');
    if (statusEl) {
        statusEl.innerHTML = currentMode === 'focus' ? 'Focusing... 🧠' : (currentMode === 'shortBreak' ? 'Taking a break ☕' : 'Long break 🧘');
    }
};

// Pause timer
window.pauseTimer = function () {
    if (!timerRunning) return;

    clearInterval(timerInterval);
    timerRunning = false;

    const startBtn = document.getElementById('timerStartBtn');
    if (startBtn) {
        startBtn.disabled = false;
        startBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    const statusEl = document.getElementById('timerStatus');
    if (statusEl) {
        statusEl.innerHTML = currentMode === 'focus' ? 'Paused. Ready to continue? ⏸️' : 'Break paused ⏸️';
    }
};

// Reset timer
window.resetTimer = function () {
    clearInterval(timerInterval);
    timerRunning = false;

    currentMode = 'focus';
    timerSeconds = currentDuration * 60;
    updateTimerDisplay();

    const startBtn = document.getElementById('timerStartBtn');
    if (startBtn) {
        startBtn.disabled = false;
        startBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    const statusEl = document.getElementById('timerStatus');
    if (statusEl) {
        statusEl.innerHTML = `Ready to focus 🎯 (${currentDuration} min)`;
    }
};

// Initialize timer
function initTimer() {
    loadTimerData();
    loadAmbientSettings();
    updateTimerDisplay();
    updateSessionCounter();

    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

console.log("✅ Dashboard JS fully loaded with all features!");