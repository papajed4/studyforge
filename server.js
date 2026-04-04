// ============================================
// SERVER.JS - Main Backend Server
// ============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const officeParser = require('officeparser');
const { YoutubeTranscript } = require('youtube-transcript');
const axios = require('axios');
const https = require('https');
const crypto = require('crypto');
const Tesseract = require('tesseract.js');
const { fromBuffer } = require('pdf2pic'); // For converting PDF pages to images
const cron = require('node-cron');

// ============================================
// CONFIGURATION
// ============================================
const app = express();
const PORT = process.env.PORT || 3000;
let aiRequestCount = 0;

// Supabase Admin Client
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        },
        global: {
            fetch: (url, options = {}) => {
                return fetch(url, {
                    ...options,
                    agent: new https.Agent({ keepAlive: true, timeout: 30000 }),
                    timeout: 30000
                });
            }
        }
    }
);

// Gemini AI Configuration
const API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

// ============================================
// PRICING CONSTANTS (for server-side)
// ============================================
const pricingTable = {
    NG: { symbol: "₦", monthly: 3500 },
    US: { symbol: "$", monthly: 8.99 },
    GB: { symbol: "£", monthly: 7.99 },
    CA: { symbol: "C$", monthly: 11.99 },
    DE: { symbol: "€", monthly: 8 },
    FR: { symbol: "€", monthly: 8 },
    IT: { symbol: "€", monthly: 8 },
    ES: { symbol: "€", monthly: 8 },
    NL: { symbol: "€", monthly: 8 },
    AU: { symbol: "A$", monthly: 12.99 },
    JP: { symbol: "¥", monthly: 1200 },
    IN: { symbol: "₹", monthly: 699 }
};

const euroCountries = [
    "FR", "DE", "ES", "IT", "NL", "BE", "PT", "IE", "AT", "FI",
    "GR", "LU", "LV", "LT", "EE", "CY", "MT", "SK", "SI"
];

const euroPricing = { symbol: "€", monthly: 8 };

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
        if (req.originalUrl === '/api/paystack-webhook') {
            req.rawBody = buf.toString();
        }
    }
}));
app.use(express.static('.'));

// Rate Limiter
const apiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: "Too many requests. Please wait a few minutes."
    }
});
app.use("/api/", apiLimiter);

// Increase timeout for large file uploads (OCR can take 2-3 minutes)
app.use((req, res, next) => {
    req.setTimeout(180000); // 3 minutes
    res.setTimeout(180000); // 3 minutes
    next();
});

// File Upload Configuration
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.docx', '.pptx', '.jpg', '.jpeg', '.png'];
        const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'), false);
        }
    }
});

// ============================================
// GEMINI AI HELPER
// ============================================
async function generateWithGemini(promptText) {
    aiRequestCount++;
    console.log(`🤖 AI Request #${aiRequestCount} - Length: ${promptText.length}`);

    const payload = {
        contents: [
            {
                role: "user",
                parts: [{ text: promptText }]
            }
        ]
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch(GEMINI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            const errData = await response.text();
            throw new Error(`Gemini API error (${response.status}): ${errData.substring(0, 200)}`);
        }

        const data = await response.json();
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!resultText) {
            throw new Error("No text generated by AI.");
        }

        return resultText;

    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error("AI request timed out after 30 seconds.");
        }
        throw error;
    }
}

// ============================================
// WEBHOOK RETRY LOGIC
// ============================================

async function saveFailedWebhook(payload, webhookType) {
    try {
        const nextRetry = new Date();
        nextRetry.setMinutes(nextRetry.getMinutes() + 5);

        const { error } = await supabaseAdmin
            .from('failed_webhooks')
            .insert({
                payload: payload,
                webhook_type: webhookType,
                attempts: 0,
                max_attempts: 5,
                next_retry: nextRetry.toISOString(),
                status: 'pending'
            });

        if (error) {
            console.error("Failed to save webhook:", error);
        } else {
            console.log(`💾 Saved failed ${webhookType} webhook for retry`);
        }
    } catch (err) {
        console.error("Error saving failed webhook:", err);
    }
}

async function processFailedWebhooks() {
    console.log("🔄 Processing failed webhooks...", new Date().toISOString());

    try {
        const { data: webhooks, error } = await supabaseAdmin
            .from('failed_webhooks')
            .select('*')
            .eq('status', 'pending')
            .lt('next_retry', new Date().toISOString())
            .order('created_at', { ascending: true })
            .limit(10);

        if (error) {
            console.error("Error fetching failed webhooks:", error);
            return;
        }

        if (!webhooks || webhooks.length === 0) {
            return;
        }

        console.log(`📨 Processing ${webhooks.length} failed webhooks...`);

        for (const webhook of webhooks) {
            let success = false;

            try {
                if (webhook.webhook_type === 'paystack') {
                    const event = webhook.payload;
                    const data = event.data;
                    const reference = data.reference;
                    const userId = data.metadata?.user_id;

                    if (!userId) continue;

                    const { data: existing } = await supabaseAdmin
                        .from('transactions')
                        .select('id')
                        .eq('reference', reference)
                        .maybeSingle();

                    if (existing) {
                        success = true;
                    } else {
                        const expiryDate = new Date();
                        const billingMode = data.metadata?.billing_mode || 'monthly';

                        if (billingMode === "yearly") {
                            expiryDate.setDate(expiryDate.getDate() + 365);
                        } else {
                            expiryDate.setDate(expiryDate.getDate() + 30);
                        }

                        await supabaseAdmin.from('transactions').insert([{
                            user_id: userId,
                            reference: reference,
                            amount: data.amount,
                            currency: data.currency,
                            status: "success",
                            created_at: new Date().toISOString()
                        }]);

                        await supabaseAdmin.from('profiles').update({
                            plan: "pro",
                            pro_expires_at: expiryDate.toISOString()
                        }).eq('id', userId);

                        console.log(`✅ Retry: Upgraded user ${userId}`);
                        success = true;
                    }
                } else if (webhook.webhook_type === 'flutterwave') {
                    const data = webhook.payload.data;
                    const txRef = data.tx_ref;
                    const userId = data.meta?.user_id;
                    const billingMode = data.meta?.billing_mode || 'monthly';

                    if (!userId) continue;

                    const { data: existing } = await supabaseAdmin
                        .from('transactions')
                        .select('id')
                        .eq('reference', txRef)
                        .maybeSingle();

                    if (existing) {
                        success = true;
                    } else {
                        const expiryDate = new Date();
                        if (billingMode === "yearly") {
                            expiryDate.setDate(expiryDate.getDate() + 365);
                        } else {
                            expiryDate.setDate(expiryDate.getDate() + 30);
                        }

                        await supabaseAdmin.from('transactions').insert([{
                            user_id: userId,
                            reference: txRef,
                            amount: data.amount * 100,
                            currency: data.currency,
                            status: "success",
                            processor: "flutterwave",
                            created_at: new Date().toISOString()
                        }]);

                        await supabaseAdmin.from('profiles').update({
                            plan: "pro",
                            pro_expires_at: expiryDate.toISOString()
                        }).eq('id', userId);

                        console.log(`✅ Retry: Upgraded user ${userId} via Flutterwave`);
                        success = true;
                    }
                }

                if (success) {
                    await supabaseAdmin
                        .from('failed_webhooks')
                        .update({ status: 'success', updated_at: new Date().toISOString() })
                        .eq('id', webhook.id);
                    console.log(`✅ Webhook ${webhook.id} processed successfully`);
                } else {
                    const newAttempts = webhook.attempts + 1;
                    const nextRetry = new Date();

                    if (newAttempts >= webhook.max_attempts) {
                        await supabaseAdmin
                            .from('failed_webhooks')
                            .update({
                                status: 'failed',
                                attempts: newAttempts,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', webhook.id);
                        console.error(`❌ Webhook ${webhook.id} failed after ${newAttempts} attempts`);
                    } else {
                        const delayMinutes = Math.pow(2, newAttempts) * 5;
                        nextRetry.setMinutes(nextRetry.getMinutes() + delayMinutes);

                        await supabaseAdmin
                            .from('failed_webhooks')
                            .update({
                                attempts: newAttempts,
                                next_retry: nextRetry.toISOString(),
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', webhook.id);
                        console.log(`⏳ Webhook ${webhook.id} retry in ${delayMinutes} min (attempt ${newAttempts}/${webhook.max_attempts})`);
                    }
                }
            } catch (err) {
                console.error(`Error processing webhook ${webhook.id}:`, err);
            }
        }
    } catch (err) {
        console.error("Error in processFailedWebhooks:", err);
    }
}

// ============================================
// AUTH MIDDLEWARE
// ============================================
async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ success: false, error: "No authorization header" });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
        return res.status(401).json({ success: false, error: "Invalid or expired token" });
    }

    req.user = data.user;
    next();
}

// ============================================
// PRICING FUNCTIONS - FIXED NIGERIAN PRICING
// ============================================
function getPricingByCountry(country) {
    const normalized = country?.toUpperCase();

    const pricingMap = {
        // NIGERIA - Paystack (NGN) - FIXED: ₦3,500 = 350,000 kobo
        NG: { price: 350000, currency: "NGN", processor: "paystack" },

        // INTERNATIONAL - Flutterwave
        US: { price: 899, currency: "USD", processor: "flutterwave" },
        GB: { price: 799, currency: "GBP", processor: "flutterwave" },
        CA: { price: 1199, currency: "CAD", processor: "flutterwave" },
        DE: { price: 800, currency: "EUR", processor: "flutterwave" },
        FR: { price: 800, currency: "EUR", processor: "flutterwave" },
        IT: { price: 800, currency: "EUR", processor: "flutterwave" },
        ES: { price: 800, currency: "EUR", processor: "flutterwave" },
        NL: { price: 800, currency: "EUR", processor: "flutterwave" }
    };

    const selected = pricingMap[normalized] || pricingMap["US"];
    return {
        amount: selected.price,
        currency: selected.currency,
        processor: selected.processor
    };
}

// ============================================
// USAGE LIMIT FUNCTIONS
// ============================================
async function checkUsageLimit(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabaseAdmin
        .from('ai_usage')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', today.toISOString());

    if (error) {
        console.error("Usage check error:", error);
        throw new Error("Usage check failed");
    }
    return data.length;
}

async function logUsage(userId, type) {
    try {
        const { error } = await supabaseAdmin
            .from('ai_usage')
            .insert([{ user_id: userId, request_type: type }]);

        if (error) {
            console.error("Usage log error:", error.message);
        }
    } catch (err) {
        console.error("Usage log exception:", err.message);
    }
}

// ============================================
// FLUTTERWAVE PAYMENT INITIALIZATION
// ============================================
async function initializeFlutterwavePayment(user, amount, currency, billingMode) {
    try {
        const txRef = `SF-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        const payload = {
            tx_ref: txRef,
            amount: amount / 100,
            currency: currency,
            redirect_url: `${process.env.APP_URL || 'http://localhost:3000'}/dashboard.html`,
            payment_options: "card",
            meta: {
                user_id: user.id,
                billing_mode: billingMode
            },
            customer: {
                email: user.email,
                name: user.user_metadata?.full_name || user.email.split('@')[0]
            },
            customizations: {
                title: "StudyForge AI Pro Plan",
                description: billingMode === "yearly" ? "Yearly Subscription" : "Monthly Subscription",
                logo: "https://studyforge.site/logo.png"
            }
        };

        const response = await axios.post(
            "https://api.flutterwave.com/v3/payments",
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data.status === "success") {
            return {
                success: true,
                authorization_url: response.data.data.link,
                tx_ref: txRef
            };
        } else {
            return {
                success: false,
                error: "Flutterwave initialization failed"
            };
        }
    } catch (error) {
        console.error("Flutterwave init error:", error.response?.data || error.message);
        return {
            success: false,
            error: "Payment initialization failed"
        };
    }
}

// ============================================
// API ENDPOINTS
// ============================================

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ status: "Server running", time: new Date().toISOString() });
});

// Condense study guide
app.post('/api/condense', requireAuth, async (req, res) => {
    try {
        const { content, language } = req.body;

        // Validate content first
        if (!content) {
            return res.status(400).json({ success: false, error: "No content provided" });
        }
        if (content.length > 60000) {
            return res.status(400).json({ success: false, error: "Content too long" });
        }

        // 🔥 FIX: Atomic usage check (no race condition)
        const { data: canProceed, error: rpcError } = await supabaseAdmin.rpc(
            'check_and_increment_usage',
            {
                user_id: req.user.id,
                max_limit: 5,
                request_type: 'condense'
            }
        );

        if (rpcError) {
            console.error("Usage check error:", rpcError);
            return res.status(500).json({ success: false, error: "Usage check failed" });
        }

        if (!canProceed) {
            return res.status(403).json({
                success: false,
                error: "Daily limit reached. Upgrade to Pro."
            });
        }

        // Detect language
        const detectedLanguage = language || 'en';
        console.log(`🌐 Responding in language: ${detectedLanguage}`);

        // AI prompt
        const prompt = `
You are a structured academic formatting engine. 
IMPORTANT: Respond in ${detectedLanguage} language.

Format the content into clean, readable sections with **visual hierarchy** that shows students what matters most.

OUTPUT FORMAT RULES:
1. Use ONLY plain text - NO markdown symbols.
2. DO NOT use any special characters for formatting.
3. Use simple bullet points with dashes (-) only when listing items.

Create these exact sections in this order WITH the emoji indicators:

📌 CORE CONCEPTS (What you absolutely must understand)
- [Concept 1 - explain in 1-2 sentences why it's foundational]
- [Concept 2 - explain in 1-2 sentences why it's foundational]
- [Concept 3 - explain in 1-2 sentences why it's foundational]

📋 KEY DEFINITIONS (Terms you need to memorize)
- [Term 1]: [Clear, concise definition]
- [Term 2]: [Clear, concise definition]
- [Term 3]: [Clear, concise definition]
- [Term 4]: [Clear, concise definition]
- [Term 5]: [Clear, concise definition]

⚖️ IMPORTANT LAWS/FORMULAS (Must-know equations and principles)
- [Law/Formula 1]: [Explanation of when/why to use it]
- [Law/Formula 2]: [Explanation of when/why to use it]
- [Law/Formula 3]: [Explanation of when/why to use it]

🎯 LIKELY EXAM TOPICS (What professors will test)
- ⭐ [High probability topic 1 - why it's likely on the exam]
- ⭐ [High probability topic 2 - why it's likely on the exam]
- ⭐ [High probability topic 3 - why it's likely on the exam]

Executive Summary
[Write a 2-3 paragraph summary here connecting all the concepts]

Exam-Ready Bullet Points
- Important point 1
- Important point 2
- Important point 3

Practice Questions
- Question 1
- Question 2
- Question 3
- Question 4
- Question 5

Flashcards (Term - Definition)
Term 1 - Definition 1
Term 2 - Definition 2
Term 3 - Definition 3
Term 4 - Definition 4
Term 5 - Definition 5

Quick Revision Sheet
- Key takeaway 1
- Key takeaway 2
- Key takeaway 3

Now format this content exactly as specified above with NO symbols:

${content}
`;

        const resultText = await generateWithGemini(prompt);

        // Note: Usage already logged in the RPC function, so no need for separate logUsage() call

        res.json({ success: true, data: resultText });

    } catch (error) {
        console.error("Condense Error:", error.message);
        res.status(500).json({ success: false, error: "Failed to condense content" });
    }
});

// Chat with AI
app.post('/api/chat', requireAuth, async (req, res) => {
    try {
        const { question, context } = req.body;

        // Validate inputs first
        if (!question || !context) {
            return res.status(400).json({ success: false, error: "Missing question or context" });
        }

        // 🔥 FIX: Atomic usage check (no race condition)
        const { data: canProceed, error: rpcError } = await supabaseAdmin.rpc(
            'check_and_increment_usage',
            {
                user_id: req.user.id,
                max_limit: 5,
                request_type: 'chat'
            }
        );

        if (rpcError) {
            console.error("Usage check error:", rpcError);
            return res.status(500).json({ success: false, error: "Usage check failed" });
        }

        if (!canProceed) {
            return res.status(403).json({
                success: false,
                error: "Daily limit reached. Upgrade to Pro."
            });
        }

        const prompt = `
You are an academic tutor.

Rules:
- Plain text only
- No markdown
- No special formatting
- Use dash bullets only if user asks for list

Context:
${context}

Question:
${question}
`;

        const answer = await generateWithGemini(prompt);

        // Note: Usage already logged in the RPC function

        res.json({ success: true, data: answer || "I couldn't generate an answer." });

    } catch (error) {
        console.error("Chat Error:", error.message);
        res.status(500).json({ success: false, error: "Failed to generate chat response" });
    }
});

// Exam mode
app.post('/api/exam-mode', requireAuth, async (req, res) => {
    try {
        const { content } = req.body;

        // Validate content first
        if (!content) {
            return res.status(400).json({ success: false, error: "No content provided" });
        }
        if (content.length > 20000) {
            return res.status(400).json({ success: false, error: "Content too long" });
        }

        // 🔥 FIX: Atomic usage check (no race condition)
        const { data: canProceed, error: rpcError } = await supabaseAdmin.rpc(
            'check_and_increment_usage',
            {
                user_id: req.user.id,
                max_limit: 5,
                request_type: 'exam'
            }
        );

        if (rpcError) {
            console.error("Usage check error:", rpcError);
            return res.status(500).json({ success: false, error: "Usage check failed" });
        }

        if (!canProceed) {
            return res.status(403).json({
                success: false,
                error: "Daily limit reached. Upgrade to Pro."
            });
        }

        const prompt = `
You are an academic exam-setting engine.

STRICT RULES:
- Plain text only
- No markdown
- No bold
- No tables

Output EXACTLY in this format:

Likely Theory Questions
- Question 1
- Question 2
- Question 3

Multiple Choice Questions
Question 1
A. Option
B. Option
C. Option
D. Option
Answer: Correct Letter

Marking Scheme
Question 1 - Model Answer
Question 2 - Model Answer

Content:
${content}
`;

        const resultText = await generateWithGemini(prompt);

        // Note: Usage already logged in the RPC function

        res.json({ success: true, data: resultText });

    } catch (error) {
        console.error("Exam Mode Error:", error.message);
        res.status(500).json({ success: false, error: "Failed to generate exam mode" });
    }
});

// ============================================
// FILE UPLOAD - WITH OCR SUPPORT
// ============================================
app.post("/api/upload-file", requireAuth, upload.single("file"), async (req, res) => {
    console.log("📁 File upload received");

    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: "No file uploaded" });
        }

        console.log("File:", req.file.originalname, "Size:", req.file.size);

        const fileName = req.file.originalname.toLowerCase();
        let extractedText = "";

        // PDF Processing - NEW VERSION
        if (fileName.endsWith(".pdf")) {
            try {
                // First try normal PDF parsing
                const data = await pdfParse(req.file.buffer);
                extractedText = data.text;
                console.log("PDF text extraction result length:", extractedText.length);

                // If we have enough text, use it
                if (extractedText && extractedText.trim().length > 200) {
                    console.log("✅ Sufficient text extracted from PDF");
                } else {
                    console.log("⚠️ Low text content, trying OCR...");

                    // Use pdf-poppler instead
                    const pdfPoppler = require('pdf-poppler');
                    const fs = require('fs');
                    const path = require('path');
                    const os = require('os');

                    // Save buffer to temp file
                    const tempDir = path.join(os.tmpdir(), 'pdf-ocr-' + Date.now());
                    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

                    const tempPdfPath = path.join(tempDir, 'document.pdf');
                    fs.writeFileSync(tempPdfPath, req.file.buffer);

                    try {
                        // Convert PDF to images using pdf-poppler
                        const opts = {
                            format: 'png',
                            out_dir: tempDir,
                            out_prefix: 'page',
                            page: null // all pages
                        };

                        await pdfPoppler.convert(tempPdfPath, opts);
                        console.log(`📄 PDF converted to images`);

                        // Find all generated images
                        const files = fs.readdirSync(tempDir);
                        const images = files.filter(f => f.startsWith('page') && f.endsWith('.png')).sort();
                        console.log(`Found ${images.length} images`);

                        let ocrText = '';

                        // Process each image
                        for (let i = 0; i < images.length; i++) {
                            const imgPath = path.join(tempDir, images[i]);
                            console.log(`🔍 Running OCR on page ${i + 1}...`);

                            const imgBuffer = fs.readFileSync(imgPath);
                            const result = await Tesseract.recognize(
                                imgBuffer,
                                'deu+eng',
                                {
                                    logger: m => {
                                        if (m.status === 'recognizing text') {
                                            console.log(`   Page ${i + 1}: ${Math.round(m.progress * 100)}%`);
                                        }
                                    }
                                }
                            );

                            ocrText += result.data.text + '\n\n';
                            console.log(`   Found ${result.data.text.length} chars`);

                            // Clean up image file
                            fs.unlinkSync(imgPath);
                        }

                        extractedText = ocrText;
                        console.log(`📝 OCR complete, total text length: ${extractedText.length}`);

                    } catch (convertErr) {
                        console.error("PDF conversion error:", convertErr.message);
                        extractedText = "";
                    } finally {
                        // Clean up temp directory
                        if (fs.existsSync(tempDir)) {
                            fs.rmdirSync(tempDir, { recursive: true });
                        }
                    }
                }

            } catch (pdfErr) {
                console.error("PDF error:", pdfErr.message);
                return res.status(422).json({
                    success: false,
                    error: "Could not read this PDF. Please take a screenshot/photo of the notes and upload as an image instead."
                });
            }
        }
        // DOCX Processing
        else if (fileName.endsWith(".docx")) {
            try {
                const result = await mammoth.extractRawText({ buffer: req.file.buffer });
                extractedText = result.value;
                console.log("DOCX extracted, length:", extractedText.length);
            } catch (docxErr) {
                return res.status(422).json({
                    success: false,
                    error: "Could not read this DOCX file."
                });
            }
        }
        // PPTX Processing
        else if (fileName.endsWith(".pptx")) {
            try {
                extractedText = await officeParser.parseOfficeAsync(req.file.buffer);
                console.log("PPTX extracted, length:", extractedText.length);
            } catch (pptxErr) {
                return res.status(422).json({
                    success: false,
                    error: "Could not read this PPTX file."
                });
            }
        }
        // Image Processing (JPG, PNG, JPEG)
        else if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") || fileName.endsWith(".png")) {
            console.log("🖼️ Processing image file...");
            try {
                // Run OCR directly on the image
                const result = await Tesseract.recognize(
                    req.file.buffer,
                    'deu+eng', // German + English
                    {
                        logger: m => console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`)
                    }
                );

                extractedText = result.data.text;
                console.log(`📝 Image OCR complete, text length: ${extractedText.length}`);

            } catch (imageErr) {
                console.error("Image OCR error:", imageErr.message);
                return res.status(422).json({
                    success: false,
                    error: "Could not read text from this image. Make sure the handwriting is clear and well-lit."
                });
            }
        }
        else {
            return res.status(400).json({
                success: false,
                error: "Only .pdf, .docx, .pptx, .jpg, .jpeg, and .png files are supported"
            });
        }

        // Check if we got any text
        if (!extractedText || extractedText.trim().length < 50) {
            return res.status(422).json({
                success: false,
                error: "No readable text found in file. The file might be scanned or image-based, or the handwriting is not recognized."
            });
        }

        // Detect language from text
        let detectedLanguage = 'en';
        // Simple language detection - look for German characters
        const hasGermanChars = /[äöüß]/i.test(extractedText);
        const hasFrenchChars = /[éèêëàâç]/i.test(extractedText);
        const hasSpanishChars = /[ñáéíóúü]/i.test(extractedText);

        if (hasGermanChars) detectedLanguage = 'de';
        else if (hasFrenchChars) detectedLanguage = 'fr';
        else if (hasSpanishChars) detectedLanguage = 'es';

        console.log(`🌐 Detected language: ${detectedLanguage}`);

        // Success - return the text with language info
        res.json({
            success: true,
            text: extractedText,
            length: extractedText.length,
            language: detectedLanguage
        });

    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({
            success: false,
            error: "Server error processing file: " + error.message
        });
    }
});

// ============================================
// INITIALIZE PAYMENT - FLUTTERWAVE ONLY (MORE RELIABLE)
// ============================================
app.post("/api/initialize-payment", requireAuth, async (req, res) => {
    try {
        const { country, billingMode } = req.body;

        if (!["monthly", "yearly"].includes(billingMode)) {
            return res.status(400).json({ success: false, error: "Invalid billing mode" });
        }

        // Check for too many payment attempts
        const { data: recentPayments } = await supabaseAdmin
            .from('transactions')
            .select('created_at')
            .eq('user_id', req.user.id)
            .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

        if (recentPayments?.length > 3) {
            return res.status(429).json({
                success: false,
                error: "Too many payment attempts. Please wait a few minutes."
            });
        }

        // Get pricing based on country
        let amount, currency, symbol;

        if (country === 'NG') {
            // Nigerian pricing in Naira
            amount = billingMode === 'monthly' ? 3500 : 3500 * 12 * 0.8; // 20% discount for yearly
            currency = "NGN";
            symbol = "₦";
        } else if (country === 'US') {
            amount = billingMode === 'monthly' ? 8.99 : 86.30;
            currency = "USD";
            symbol = "$";
        } else if (country === 'GB') {
            amount = billingMode === 'monthly' ? 7.99 : 76.70;
            currency = "GBP";
            symbol = "£";
        } else {
            // Default to USD
            amount = billingMode === 'monthly' ? 8.99 : 86.30;
            currency = "USD";
            symbol = "$";
        }

        // For Flutterwave, amount should be in whole units (not cents)
        const flutterwaveAmount = amount;

        const txRef = `SF-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        console.log(`💰 Initializing ${billingMode} payment: ${amount} ${currency} for user ${req.user.id}`);

        // Use Flutterwave
        const payload = {
            tx_ref: txRef,
            amount: flutterwaveAmount,
            currency: currency,
            redirect_url: `${process.env.APP_URL || 'http://localhost:3000'}/dashboard.html?payment=success`,
            payment_options: "card,ussd,banktransfer, mobilemoney",
            meta: {
                user_id: req.user.id,
                billing_mode: billingMode,
                country: country
            },
            customer: {
                email: req.user.email,
                name: req.user.user_metadata?.full_name || req.user.email.split('@')[0]
            },
            customizations: {
                title: "StudyForge AI Pro Plan",
                description: billingMode === "yearly" ? "Yearly Subscription (Save 20%)" : "Monthly Subscription",
                logo: "https://studyforge.site/logo.png"
            }
        };

        try {
            const response = await axios.post(
                "https://api.flutterwave.com/v3/payments",
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );

            console.log("Flutterwave response:", response.data.status);

            if (response.data.status === "success") {
                // Store transaction reference
                await supabaseAdmin
                    .from('transactions')
                    .insert([{
                        user_id: req.user.id,
                        reference: txRef,
                        amount: amount,
                        currency: currency,
                        status: "pending",
                        processor: "flutterwave",
                        metadata: { billing_mode: billingMode, country: country },
                        created_at: new Date().toISOString()
                    }]);

                return res.json({
                    success: true,
                    authorization_url: response.data.data.link,
                    processor: "flutterwave",
                    tx_ref: txRef
                });
            } else {
                throw new Error(response.data.message || "Flutterwave initialization failed");
            }

        } catch (flutterError) {
            console.error("Flutterwave error:", flutterError.response?.data || flutterError.message);
            return res.status(400).json({
                success: false,
                error: flutterError.response?.data?.message || "Payment initialization failed. Please try again."
            });
        }

    } catch (error) {
        console.error("Payment Init Error:", error.message);
        res.status(500).json({
            success: false,
            error: error.message || "Payment initialization error"
        });
    }
});

// ============================================
// VERIFY PAYMENT
// ============================================
app.post('/api/verify-payment', requireAuth, async (req, res) => {
    try {
        const { reference, billingMode } = req.body;

        console.log(`🔍 Verifying payment: ${reference}, mode: ${billingMode}`);

        if (!reference) {
            return res.status(400).json({ success: false, error: "No reference provided" });
        }

        const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: {
                'Authorization': `Bearer ${process.env.PAYSTACK_SECRET}`,
                'Content-Type': 'application/json'
            }
        });

        const paymentData = response.data.data;

        if (paymentData.status !== "success") {
            return res.status(400).json({
                success: false,
                error: "Payment not successful",
                status: paymentData.status
            });
        }

        // 👇 EXTRA SECURITY: Check if payment was intended for this user 👇
        if (paymentData.metadata?.user_id !== req.user.id) {
            console.warn(`⚠️ Payment mismatch: Payment for user ${paymentData.metadata?.user_id} attempted by user ${req.user.id}`);
            return res.status(403).json({
                success: false,
                error: "Payment not intended for this account"
            });
        }

        const { data: existing } = await supabaseAdmin
            .from('transactions')
            .select('id')
            .eq('reference', reference)
            .maybeSingle();

        if (existing) {
            return res.json({
                success: true,
                message: "Transaction already processed",
                alreadyPro: true
            });
        }

        const expiryDate = new Date();
        if (billingMode === "yearly") {
            expiryDate.setDate(expiryDate.getDate() + 365);
        } else {
            expiryDate.setDate(expiryDate.getDate() + 30);
        }

        await supabaseAdmin.from('transactions').insert([{
            user_id: req.user.id,
            reference: reference,
            amount: paymentData.amount,
            currency: paymentData.currency,
            status: "success",
            created_at: new Date().toISOString()
        }]);

        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({
                plan: "pro",
                pro_expires_at: expiryDate.toISOString()
            })
            .eq('id', req.user.id);

        if (updateError) {
            console.error('❌ Profile update error:', updateError);
            return res.status(500).json({
                success: false,
                error: "Failed to update profile"
            });
        }

        console.log(`✅ User ${req.user.id} upgraded to Pro until ${expiryDate.toDateString()}`);

        res.json({
            success: true,
            message: "Payment verified and account upgraded",
            plan: "pro",
            expires_at: expiryDate.toISOString()
        });

    } catch (err) {
        console.error("❌ Payment verification error:", err.message);
        res.status(500).json({
            success: false,
            error: "Payment verification failed",
            details: err.message
        });
    }
});

// ============================================
// VERIFY TRIAL PAYMENT (Paystack Popup)
// ============================================
app.post('/api/verify-trial-payment', requireAuth, async (req, res) => {
    try {
        const { reference, planType } = req.body;

        // Verify with Paystack
        const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET}` }
        });

        const data = response.data.data;

        if (data.status !== 'success') {
            return res.status(400).json({ success: false, error: "Payment not successful" });
        }

        // Check if user already used a trial
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('trial_used')
            .eq('id', req.user.id)
            .single();

        if (profile?.trial_used) {
            return res.status(400).json({ success: false, error: "Trial already used" });
        }

        const trialDays = planType === 'monthly' ? 3 : 7;
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + trialDays);

        // Activate trial
        await supabaseAdmin.from('profiles').update({
            trial_used: true,
            trial_type: planType,
            trial_start_date: new Date().toISOString(),
            trial_end_date: trialEndDate.toISOString(),
            plan: 'pro',
            pro_expires_at: trialEndDate.toISOString()
        }).eq('id', req.user.id);

        res.json({ success: true, trial_days: trialDays });

    } catch (err) {
        console.error("Trial verification error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================
// COMPLETE ONBOARDING
// ============================================
app.post('/api/complete-onboarding', requireAuth, async (req, res) => {
    try {
        const { study_level, study_goal } = req.body;

        const { error } = await supabaseAdmin
            .from('profiles')
            .update({
                onboarding_completed: true,
                study_level: study_level,
                study_goal: study_goal
            })
            .eq('id', req.user.id);

        if (error) throw error;

        res.json({ success: true });
    } catch (err) {
        console.error("Onboarding error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================
// GET USER PROFILE (for onboarding check)
// ============================================
app.get('/api/profile', requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('onboarding_completed, trial_used, plan, pro_expires_at, trial_end_date, trial_type')
            .eq('id', req.user.id)
            .single();

        if (error) {
            // If no profile exists, create one
            if (error.code === 'PGRST116') {
                await supabaseAdmin
                    .from('profiles')
                    .insert({ id: req.user.id, plan: 'free', created_at: new Date().toISOString() });

                return res.json({
                    success: true,
                    onboarding_completed: false,
                    trial_used: false,
                    plan: 'free'
                });
            }
            throw error;
        }

        res.json({
            success: true,
            onboarding_completed: data.onboarding_completed || false,
            trial_used: data.trial_used || false,
            plan: data.plan || 'free',
            trial_active: data.trial_end_date ? new Date(data.trial_end_date) > new Date() : false
        });
    } catch (err) {
        console.error("Profile fetch error:", err);
        res.json({
            success: true,
            onboarding_completed: false,
            trial_used: false,
            plan: 'free'
        });
    }
});

// ============================================
// GET PUBLIC USAGE STATS (With multipliers)
// ============================================
app.get('/api/stats', async (req, res) => {
    try {
        console.log("📊 Public stats endpoint called");

        // Get real data from database
        const { data: guides, error: guidesError } = await supabaseAdmin
            .from('study_guides')
            .select('id, user_id, content');

        if (guidesError) {
            console.error("Guides error:", guidesError);
            return res.json({
                success: true,
                stats: { study_guides: 1240, active_users: 40, pages_condensed: 2500 }
            });
        }

        if (!guides || guides.length === 0) {
            // If no data, show reasonable placeholder numbers
            return res.json({
                success: true,
                stats: { study_guides: 1240, active_users: 40, pages_condensed: 2500 }
            });
        }

        // Count unique users
        const uniqueUsers = new Set();
        guides.forEach(guide => {
            if (guide.user_id) uniqueUsers.add(guide.user_id);
        });

        // Calculate total pages
        let totalPages = 0;
        guides.forEach(guide => {
            if (guide.content) {
                const wordCount = guide.content.split(/\s+/).length;
                totalPages += Math.ceil(wordCount / 500);
            }
        });

        // Apply multipliers:
        // Study guides × 30, Active users × 4, Pages × 30
        const stats = {
            study_guides: Math.floor(guides.length * 30) || 1240,
            active_users: Math.floor(uniqueUsers.size * 4) || 40,
            pages_condensed: Math.floor(totalPages * 30) || 2500
        };

        console.log("📊 Real data:", { guides: guides.length, users: uniqueUsers.size, pages: totalPages });
        console.log("📊 Display stats:", stats);

        res.json({
            success: true,
            stats: stats
        });

    } catch (err) {
        console.error("Stats error:", err);
        // Fallback to reasonable numbers
        res.json({
            success: true,
            stats: { study_guides: 1240, active_users: 40, pages_condensed: 2500 }
        });
    }
});

// ============================================
// GET LOCALIZED PRICING FOR TRIAL MODAL
// ============================================
app.get('/api/pricing-local', async (req, res) => {
    try {
        let country = req.query.country || 'US';

        let pricing = pricingTable[country] ||
            (euroCountries.includes(country) ? euroPricing : pricingTable["US"]);

        const monthlyPrice = pricing.monthly;
        const symbol = pricing.symbol;
        const yearlyPrice = (monthlyPrice * 12 * 0.8).toFixed(2);

        let monthlyDisplay = `${symbol}${monthlyPrice}`;
        let yearlyDisplay = `${symbol}${yearlyPrice}`;

        // Special formatting for NGN (no decimal)
        if (country === 'NG') {
            monthlyDisplay = `${symbol}${monthlyPrice.toLocaleString()}`;
            yearlyDisplay = `${symbol}${Math.round(monthlyPrice * 12 * 0.8).toLocaleString()}`;
        }

        res.json({
            success: true,
            monthly: monthlyPrice,
            yearly: yearlyPrice,
            monthly_display: monthlyDisplay,
            yearly_display: yearlyDisplay,
            symbol: symbol,
            currency: pricing.currency
        });

    } catch (err) {
        console.error("Pricing error:", err);
        res.json({
            success: true,
            monthly: 8.99,
            yearly: 86.30,
            monthly_display: '$8.99',
            yearly_display: '$86.30',
            symbol: '$',
            currency: 'USD'
        });
    }
});

// ============================================
// TEST SUPABASE CONNECTION
// ============================================
app.get('/api/test-db', async (req, res) => {
    try {
        // Try a simple query
        const { data, error, count } = await supabaseAdmin
            .from('study_guides')
            .select('*', { count: 'exact' });

        console.log("TEST DB - Data length:", data?.length);
        console.log("TEST DB - Count:", count);
        console.log("TEST DB - Error:", error);

        res.json({
            success: true,
            data_length: data?.length || 0,
            count: count || 0,
            error: error?.message || null,
            sample: data?.slice(0, 2) || []
        });

    } catch (err) {
        console.error("Test DB error:", err);
        res.json({ error: err.message });
    }
});

// ============================================
// DEBUG STATS ENDPOINT (Temporary)
// ============================================
app.get('/api/debug-stats', async (req, res) => {
    try {
        // Try a simple count first
        const { count, error } = await supabaseAdmin
            .from('study_guides')
            .select('*', { count: 'exact', head: true });

        console.log("Debug - Count result:", { count, error });

        // Also try to get one record
        const { data, error2 } = await supabaseAdmin
            .from('study_guides')
            .select('*')
            .limit(1);

        console.log("Debug - Sample record:", { data, error2 });

        res.json({
            count: count || 0,
            error: error?.message || null,
            sample: data || [],
            sampleError: error2?.message || null
        });

    } catch (err) {
        console.error("Debug error:", err);
        res.json({ error: err.message });
    }
});

// ============================================
// START FREE TRIAL (NO CARD REQUIRED)
// ============================================
// START FREE TRIAL (No card required)
app.post('/api/start-free-trial', requireAuth, async (req, res) => {
    try {
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('trial_used, plan')
            .eq('id', req.user.id)
            .single();

        if (profile?.trial_used) {
            return res.status(400).json({
                success: false,
                error: "You've already used your free trial."
            });
        }

        if (profile?.plan === 'pro') {
            return res.status(400).json({
                success: false,
                error: "You're already on Pro!"
            });
        }

        const trialDays = 3;
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + trialDays);

        await supabaseAdmin
            .from('profiles')
            .upsert({
                id: req.user.id,
                trial_used: true,
                trial_type: 'free',
                trial_start_date: new Date().toISOString(),
                trial_end_date: trialEndDate.toISOString(),
                plan: 'pro',
                pro_expires_at: trialEndDate.toISOString()
            });

        res.json({ success: true, trial_days: trialDays });

    } catch (err) {
        console.error("Free trial error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================
// START PAID TRIAL (Card required - Paystack/Flutterwave)
// ============================================
app.post('/api/start-paid-trial', requireAuth, async (req, res) => {
    try {
        const { trial_type, plan, country } = req.body;

        // Check if user already used a trial
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('trial_used')
            .eq('id', req.user.id)
            .single();

        if (profile?.trial_used) {
            return res.status(400).json({
                success: false,
                error: "You've already used your one-time trial."
            });
        }

        const trialDays = trial_type === 'monthly' ? 5 : 10;
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + trialDays);

        // Get pricing for the user's country
        const pricing = getPricingByCountry(country || 'US');

        // Store trial intent in database
        const reference = `TRIAL-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        await supabaseAdmin.from('transactions').insert([{
            user_id: req.user.id,
            reference: reference,
            amount: 0,
            currency: pricing.currency,
            status: "pending",
            type: "trial_authorization",
            metadata: {
                trial_type: trial_type,
                plan: plan,
                trial_days: trialDays,
                trial_end_date: trialEndDate.toISOString(),
                country: country
            },
            created_at: new Date().toISOString()
        }]);

        // Initialize payment with $0 authorization
        let authorization_url;

        if (pricing.processor === 'paystack') {
            // For Paystack: $0 authorization (minimum 50 kobo for NGN, $0.01 for others)
            const amountInCents = pricing.currency === 'NGN' ? 50 : 1;

            const response = await axios.post("https://api.paystack.co/transaction/initialize", {
                email: req.user.email,
                amount: amountInCents,
                currency: pricing.currency,
                metadata: {
                    user_id: req.user.id,
                    type: 'trial_authorization',
                    trial_type: trial_type,
                    trial_days: trialDays
                },
                callback_url: `${process.env.APP_URL || 'http://localhost:3000'}/dashboard.html?trial=success`
            }, {
                headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET}` }
            });

            if (!response.data.status) {
                return res.status(400).json({ success: false, error: "Failed to initialize trial" });
            }

            authorization_url = response.data.data.authorization_url;

        } else {
            // Flutterwave
            const response = await axios.post("https://api.flutterwave.com/v3/payments", {
                tx_ref: reference,
                amount: 0,
                currency: pricing.currency,
                redirect_url: `${process.env.APP_URL || 'http://localhost:3000'}/dashboard.html?trial=success`,
                payment_options: "card",
                meta: {
                    user_id: req.user.id,
                    type: 'trial_authorization',
                    trial_type: trial_type,
                    trial_days: trialDays
                },
                customer: {
                    email: req.user.email,
                    name: req.user.user_metadata?.full_name || req.user.email.split('@')[0]
                },
                customizations: {
                    title: "StudyForge Free Trial",
                    description: `Start your ${trialDays}-day free trial`,
                    logo: "https://studyforge.site/logo.png"
                }
            }, {
                headers: { 'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` }
            });

            if (response.data.status !== "success") {
                return res.status(400).json({ success: false, error: "Failed to initialize trial" });
            }

            authorization_url = response.data.data.link;
        }

        res.json({
            success: true,
            authorization_url: authorization_url,
            trial_days: trialDays,
            processor: pricing.processor
        });

    } catch (error) {
        console.error("Paid trial error:", error);
        res.status(500).json({ success: false, error: "Failed to start trial" });
    }
});

// ============================================
// STUDY GUIDES ENDPOINTS - FIXED
// ============================================
app.post('/api/save-guide', requireAuth, async (req, res) => {
    try {
        const { title, content, subject, course_code, tags } = req.body;

        console.log("=".repeat(50));
        console.log("SAVING GUIDE");
        console.log("Title:", title);
        console.log("Content length:", content?.length || 0);
        console.log("=".repeat(50));

        if (!content) {
            return res.status(400).json({ success: false, error: "Content is required" });
        }

        const { data, error } = await supabaseAdmin
            .from('study_guides')
            .insert({
                user_id: req.user.id,
                title: title || "Untitled Guide",
                content: content,  // THIS IS THE FULL GENERATED CONTENT
                subject: subject || null,
                course_code: course_code || null,
                tags: tags || [],
                created_at: new Date().toISOString()
            })
            .select();

        if (error) {
            console.error("Save error:", error);
            return res.status(500).json({ success: false, error: error.message });
        }

        console.log("✅ Guide saved with content length:", content.length);
        res.json({ success: true, data: data });

    } catch (err) {
        console.error("Save exception:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/my-guides', requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('study_guides')
            .select('*')  // MUST BE '*' to get content
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, guides: data || [] });

    } catch (err) {
        res.status(500).json({ success: false, error: "Failed to fetch guides" });
    }
});

// Update guide - handles title, subject, course_code, tags
app.put('/api/update-guide/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, subject, course_code, tags } = req.body;

        // Build update object with only provided fields
        const updates = {};
        if (title !== undefined) updates.title = title;
        if (subject !== undefined) updates.subject = subject;
        if (course_code !== undefined) updates.course_code = course_code;
        if (tags !== undefined) updates.tags = tags;

        // Always update the updated_at timestamp
        updates.updated_at = new Date().toISOString();

        console.log("Updating guide:", id, "with:", updates);

        const { data, error } = await supabaseAdmin
            .from('study_guides')
            .update(updates)
            .eq('id', id)
            .eq('user_id', req.user.id)
            .select();

        if (error) {
            console.error("Update error:", error);
            return res.status(500).json({ success: false, error: "Update failed: " + error.message });
        }

        console.log("Guide updated successfully:", data);
        res.json({ success: true, data: data });

    } catch (err) {
        console.error("Update exception:", err);
        res.status(500).json({ success: false, error: "Update failed: " + err.message });
    }
});

// ============================================
// DELETE STUDY GUIDE
// ============================================
app.delete('/api/delete-guide/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabaseAdmin
            .from('study_guides')
            .delete()
            .eq('id', id)
            .eq('user_id', req.user.id);

        if (error) throw error;

        res.json({ success: true });

    } catch (err) {
        console.error("Delete error:", err);
        res.status(500).json({ success: false, error: "Delete failed" });
    }
});

// ============================================
// USAGE AND ACCOUNT ENDPOINTS
// ============================================
app.get('/api/usage', requireAuth, async (req, res) => {
    try {
        const usageCount = await checkUsageLimit(req.user.id);
        res.json({ success: true, used: usageCount, limit: 5 });
    } catch (error) {
        res.status(500).json({ success: false, error: "Failed to fetch usage" });
    }
});

app.get('/api/account', requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('plan, pro_expires_at, trial_used, trial_type, trial_start_date, trial_end_date')
            .eq('id', req.user.id)
            .maybeSingle();

        if (error) {
            console.error("Account error:", error);
            return res.json({ success: true, plan: 'free', expires_at: null, trial_used: false, trial_active: false, trial_days_left: 0 });
        }

        if (!data) {
            await supabaseAdmin
                .from('profiles')
                .insert({ id: req.user.id, plan: 'free', created_at: new Date().toISOString() });
            return res.json({ success: true, plan: 'free', expires_at: null, trial_used: false, trial_active: false, trial_days_left: 0 });
        }

        // Calculate trial status correctly
        let isTrialActive = false;
        let trialDaysLeft = 0;

        if (data.trial_used && data.trial_end_date) {
            const now = new Date();
            const trialEnd = new Date(data.trial_end_date);
            isTrialActive = trialEnd > now;
            if (isTrialActive) {
                trialDaysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
            }
        }

        console.log(`Account check for ${req.user.id}: trial_used=${data.trial_used}, trial_end=${data.trial_end_date}, isActive=${isTrialActive}, daysLeft=${trialDaysLeft}`);

        res.json({
            success: true,
            plan: data.plan || "free",
            expires_at: data.pro_expires_at || null,
            trial_used: data.trial_used || false,
            trial_type: data.trial_type || null,
            trial_active: isTrialActive,
            trial_days_left: trialDaysLeft
        });

    } catch (err) {
        console.error("Account error:", err);
        res.json({ success: true, plan: 'free', expires_at: null, trial_used: false, trial_active: false, trial_days_left: 0 });
    }
});

// ============================================
// YOUTUBE TRANSCRIPT
// ============================================
app.post('/api/youtube-transcript', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: "No URL provided" });

        const transcript = await YoutubeTranscript.fetchTranscript(url);
        const text = transcript.map(item => item.text).join(' ');

        res.json({ success: true, text });

    } catch (error) {
        res.status(500).json({ error: "Transcript failed", details: error.message });
    }
});

// ============================================
// SAVE QUIZ ATTEMPT
// ============================================
app.post('/api/save-quiz-attempt', requireAuth, async (req, res) => {
    try {
        const { guide_id, score, total_questions, percentage, answers } = req.body;

        console.log(`📊 Saving quiz attempt for user ${req.user.id}`);
        console.log(`   Score: ${score}/${total_questions} (${percentage}%)`);

        const { data, error } = await supabaseAdmin
            .from('quiz_attempts')
            .insert({
                user_id: req.user.id,
                guide_id: guide_id,
                score: score,
                total_questions: total_questions,
                percentage: percentage,
                answers: answers
            })
            .select();

        if (error) throw error;

        res.json({ success: true, data: data });

    } catch (err) {
        console.error("Save quiz attempt error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================
// GET QUIZ STATS FOR A GUIDE
// ============================================
app.get('/api/quiz-stats/:guideId', requireAuth, async (req, res) => {
    try {
        const { guideId } = req.params;

        console.log(`📊 Fetching quiz stats for guide ${guideId}`);

        // Get all quiz attempts for this guide
        const { data: attempts, error } = await supabaseAdmin
            .from('quiz_attempts')
            .select('*')
            .eq('user_id', req.user.id)
            .eq('guide_id', guideId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!attempts || attempts.length === 0) {
            return res.json({ success: true, stats: null });
        }

        // Calculate stats
        const lastAttempt = attempts[0];
        const bestAttempt = attempts.reduce((best, a) => a.percentage > best.percentage ? a : best, attempts[0]);
        const averageScore = Math.round(attempts.reduce((sum, a) => sum + a.percentage, 0) / attempts.length);

        // Collect weak topics from wrong answers
        const weakTopics = new Set();
        attempts.forEach(attempt => {
            if (attempt.answers && attempt.answers.weak_topics) {
                attempt.answers.weak_topics.forEach(topic => weakTopics.add(topic));
            }
        });

        const stats = {
            last_score: lastAttempt.percentage,
            last_score_date: lastAttempt.created_at,
            best_score: bestAttempt.percentage,
            average_score: averageScore,
            attempts_count: attempts.length,
            weak_topics: Array.from(weakTopics).slice(0, 3),
            needs_review: lastAttempt.percentage < 70
        };

        res.json({ success: true, stats });

    } catch (err) {
        console.error("Quiz stats error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================
// GET ALL QUIZ ATTEMPTS FOR USER
// ============================================
app.get('/api/all-quiz-attempts', requireAuth, async (req, res) => {
    console.log("🔥 /api/all-quiz-attempts endpoint HIT!"); // 👈 ADD THIS LINE
    try {
        console.log(`📊 Fetching all quiz attempts for user ${req.user.id}`);

        const { data, error } = await supabaseAdmin
            .from('quiz_attempts')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        console.log(`✅ Found ${data?.length || 0} quiz attempts`);
        res.json({ success: true, attempts: data || [] });

    } catch (err) {
        console.error("Fetch all attempts error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================
// WEBHOOKS
// ============================================
// ============================================
// PAYSTACK WEBHOOK (UPDATED FOR TRIALS)
// ============================================
app.post('/api/paystack-webhook', async (req, res) => {
    try {
        const hash = crypto
            .createHmac('sha512', process.env.PAYSTACK_SECRET)
            .update(req.rawBody)
            .digest('hex');

        if (hash !== req.headers['x-paystack-signature']) {
            console.log("❌ Invalid Paystack signature");
            return res.sendStatus(401);
        }

        const event = req.body;

        if (event.event === "charge.success") {
            const data = event.data;
            const reference = data.reference;
            const userId = data.metadata?.user_id;
            const transactionType = data.metadata?.type;
            const billingMode = data.metadata?.billing_mode || 'monthly';
            const trialDays = data.metadata?.trial_days || (billingMode === 'monthly' ? 3 : 7);

            // 🔥 NEW: Handle trial authorization
            if (data.metadata?.trial_days || transactionType === 'trial_authorization') {
                const { data: existing } = await supabaseAdmin
                    .from('transactions')
                    .select('id')
                    .eq('reference', reference)
                    .maybeSingle();

                if (existing) return res.sendStatus(200);

                const trialEndDate = new Date();
                trialEndDate.setDate(trialEndDate.getDate() + trialDays);

                // Update profile with trial info
                await supabaseAdmin.from('profiles').update({
                    trial_used: true,
                    trial_type: billingMode,
                    trial_start_date: new Date().toISOString(),
                    trial_end_date: trialEndDate.toISOString(),
                    plan: 'pro',
                    pro_expires_at: trialEndDate.toISOString()
                }).eq('id', userId);

                // Store transaction
                await supabaseAdmin.from('transactions').insert([{
                    user_id: userId,
                    reference: reference,
                    amount: data.amount,
                    currency: data.currency,
                    status: "success",
                    type: "trial_authorization",
                    metadata: { trial_days: trialDays, billing_mode: billingMode },
                    created_at: new Date().toISOString()
                }]);

                console.log(`✅ Trial started for user ${userId}, type: ${billingMode}, expires: ${trialEndDate.toDateString()}`);
                return res.sendStatus(200);
            }

            // 🔥 Handle regular payment (existing users upgrading)
            if (!userId) return res.sendStatus(200);

            const { data: existing } = await supabaseAdmin
                .from('transactions')
                .select('id')
                .eq('reference', reference)
                .maybeSingle();

            if (existing) return res.sendStatus(200);

            const expiryDate = new Date();
            if (billingMode === "yearly") {
                expiryDate.setDate(expiryDate.getDate() + 365);
            } else {
                expiryDate.setDate(expiryDate.getDate() + 30);
            }

            await supabaseAdmin.from('transactions').insert([{
                user_id: userId,
                reference: reference,
                amount: data.amount,
                currency: data.currency,
                status: "success",
                created_at: new Date().toISOString()
            }]);

            await supabaseAdmin.from('profiles').update({
                plan: "pro",
                pro_expires_at: expiryDate.toISOString()
            }).eq('id', userId);

            console.log(`✅ Webhook upgraded user ${userId} until ${expiryDate.toDateString()}`);
        }

        res.sendStatus(200);

    } catch (err) {
        console.error("Webhook error:", err.message);
        await saveFailedWebhook(req.body, 'paystack');
        res.sendStatus(500);
    }
});

// ============================================
// FLUTTERWAVE WEBHOOK (WITH CARD TOKEN SAVING)
// ============================================
app.post('/api/flutterwave-webhook', async (req, res) => {
    try {
        const secretHash = process.env.FLUTTERWAVE_SECRET_HASH || "studyforge_secret";
        const signature = req.headers['verif-hash'];

        if (!signature || signature !== secretHash) {
            console.log("❌ Invalid Flutterwave signature");
            return res.sendStatus(401);
        }

        const event = req.body;
        console.log("📨 Flutterwave webhook received:", event.event);

        if (event.event === "charge.completed" && event.data.status === "successful") {
            const data = event.data;
            const txRef = data.tx_ref;
            const userId = data.meta?.user_id;
            const billingMode = data.meta?.billing_mode || 'monthly';

            if (!userId) {
                console.log("No user_id in webhook");
                return res.sendStatus(200);
            }

            // Check if already processed
            const { data: existing } = await supabaseAdmin
                .from('transactions')
                .select('id')
                .eq('reference', txRef)
                .maybeSingle();

            if (existing) {
                console.log(`Transaction ${txRef} already processed`);
                return res.sendStatus(200);
            }

            // Calculate expiry date
            const expiryDate = new Date();
            if (billingMode === "yearly") {
                expiryDate.setFullYear(expiryDate.getFullYear() + 1);
            } else {
                expiryDate.setMonth(expiryDate.getMonth() + 1);
            }

            // Get card token for recurring charges
            const cardToken = data.card?.token;
            
            if (cardToken) {
                console.log(`💳 Card token saved for user ${userId}`);
            } else {
                console.log(`⚠️ No card token received - recurring billing won't work`);
            }

            // Update user to Pro with token
            await supabaseAdmin
                .from('profiles')
                .update({
                    plan: "pro",
                    pro_expires_at: expiryDate.toISOString(),
                    subscription_id: txRef,
                    flutterwave_token: cardToken,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            // Record successful transaction
            await supabaseAdmin
                .from('transactions')
                .insert([{
                    user_id: userId,
                    reference: txRef,
                    amount: data.amount,
                    currency: data.currency,
                    status: "success",
                    processor: "flutterwave",
                    billing_mode: billingMode,
                    has_token: !!cardToken,
                    expires_at: expiryDate.toISOString(),
                    created_at: new Date().toISOString()
                }]);

            console.log(`✅ User ${userId} upgraded to Pro (${billingMode}) until ${expiryDate.toDateString()}`);
        }

        res.sendStatus(200);

    } catch (err) {
        console.error("Flutterwave webhook error:", err.message);
        res.sendStatus(500);
    }
});

// ============================================
// DELETE ACCOUNT
// ============================================
app.delete('/api/delete-account', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`🗑️ Deleting account for user ${userId}`);

        // Delete all user data
        await supabaseAdmin.from('quiz_attempts').delete().eq('user_id', userId);
        await supabaseAdmin.from('study_guides').delete().eq('user_id', userId);
        await supabaseAdmin.from('ai_usage').delete().eq('user_id', userId);
        await supabaseAdmin.from('transactions').delete().eq('user_id', userId);
        await supabaseAdmin.from('profiles').delete().eq('id', userId);

        // Delete the user from auth (this is the final step)
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (error) throw error;

        console.log(`✅ Account deleted for user ${userId}`);
        res.json({ success: true });

    } catch (err) {
        console.error("Delete account error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================
// PRO EXPIRY CRON JOB (Runs every day at midnight)
// ============================================

// ============================================
// SUBSCRIPTION MANAGEMENT - CLEAN VERSION
// ============================================

// Downgrade expired Pro users to Free
async function expireProUsers() {
    try {
        console.log('🕐 Checking for expired Pro users...', new Date().toISOString());

        const { data: expiredUsers, error } = await supabaseAdmin
            .from('profiles')
            .select('id, email, pro_expires_at')
            .eq('plan', 'pro')
            .lt('pro_expires_at', new Date().toISOString());

        if (error) {
            console.error('❌ Expiry check error:', error.message);
            return;
        }

        if (expiredUsers && expiredUsers.length > 0) {
            console.log(`⏰ Found ${expiredUsers.length} expired Pro users to downgrade`);

            for (const user of expiredUsers) {
                await supabaseAdmin
                    .from('profiles')
                    .update({ plan: 'free', pro_expires_at: null })
                    .eq('id', user.id);
                console.log(`   Downgraded user ${user.email} - subscription expired on ${user.pro_expires_at}`);
            }
        } else {
            console.log('✅ No expired Pro users found');
        }

    } catch (err) {
        console.error('❌ Expiry cron error:', err.message);
    }
}

// Check for users expiring soon (send reminders)
async function checkExpiringSoon() {
    try {
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

        const { data: expiringSoon, error } = await supabaseAdmin
            .from('profiles')
            .select('id, email, pro_expires_at')
            .eq('plan', 'pro')
            .lt('pro_expires_at', threeDaysFromNow.toISOString())
            .gt('pro_expires_at', new Date().toISOString());

        if (error) {
            console.error("Error checking expiring subscriptions:", error);
            return;
        }

        if (expiringSoon && expiringSoon.length > 0) {
            console.log(`📧 ${expiringSoon.length} users have subscriptions expiring in < 3 days`);
            for (const user of expiringSoon) {
                console.log(`   - ${user.email} expires on ${new Date(user.pro_expires_at).toDateString()}`);
                // TODO: Send email reminder
            }
        }
    } catch (err) {
        console.error("Expiring soon check error:", err);
    }
}

// Schedule: Run expiry check at midnight
cron.schedule('0 0 * * *', () => {
    expireProUsers();
});

// Schedule: Check expiring soon at 9 AM daily
cron.schedule('0 9 * * *', () => {
    checkExpiringSoon();
});

// Run once on startup
setTimeout(() => {
    expireProUsers();
    checkExpiringSoon();
}, 5000);

// ============================================
// CHECK BILLING STATUS (for modals)
// ============================================
app.get('/api/check-billing-status', requireAuth, async (req, res) => {
    try {
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('plan, trial_used, trial_end_date, pro_expires_at')
            .eq('id', req.user.id)
            .single();

        // Check if there's a pending billing result in session
        // This would be set by webhook after auto-billing attempt
        const { data: recentTransaction } = await supabaseAdmin
            .from('transactions')
            .select('status, type')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        let showSuccessModal = false;
        let showFailureModal = false;

        // If user just upgraded and is now Pro, show success
        if (profile?.plan === 'pro' && !profile?.trial_used) {
            // Check if we haven't shown modal for this transaction
            const modalShown = await supabaseAdmin
                .from('profiles')
                .select('modal_shown')
                .eq('id', req.user.id)
                .single();

            if (!modalShown?.modal_shown) {
                showSuccessModal = true;
                await supabaseAdmin
                    .from('profiles')
                    .update({ modal_shown: true })
                    .eq('id', req.user.id);
            }
        }

        // If trial expired and billing failed, show failure
        if (profile?.plan === 'free' && profile?.trial_used && new Date(profile.trial_end_date) < new Date()) {
            showFailureModal = true;
        }

        res.json({
            success: true,
            show_success_modal: showSuccessModal,
            show_failure_modal: showFailureModal
        });

    } catch (err) {
        console.error("Billing status error:", err);
        res.json({ success: true, show_success_modal: false, show_failure_modal: false });
    }
});



// ============================================
// HEALTH CHECK ENDPOINT - Add this anywhere in server.js
// ============================================
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'alive',
        time: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ============================================
// CATCH-ALL ROUTE (MUST BE LAST)
// ============================================
app.use((req, res) => {
    res.status(404).sendFile(__dirname + '/404.html');
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
    console.log(`🚀 StudyForge AI Server running on http://localhost:${PORT}`);
    console.log(`📝 Environment: Node ${process.version}`);
});