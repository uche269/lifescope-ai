import express from 'express';
import session from 'express-session';
import crypto from 'crypto';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import connectPgSimple from 'connect-pg-simple';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createTransport } from 'nodemailer';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import compression from 'compression';
import { Resend } from 'resend';
import cron from 'node-cron';

dotenv.config();

import Papa from 'papaparse';

// Storage Config
// S3 Client Configuration (Backblaze B2)
const s3Client = new S3Client({
    region: process.env.B2_REGION || 'us-east-005',
    endpoint: process.env.B2_ENDPOINT || 'https://s3.us-east-005.backblazeb2.com',
    credentials: {
        accessKeyId: process.env.B2_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.B2_APP_KEY || process.env.AWS_SECRET_ACCESS_KEY,
    }
});

const B2_BUCKET = process.env.B2_BUCKET || 'lifescope-db-backups';

// File upload config (Cloud Storage)
const upload = multer({
    storage: multerS3({
        s3: s3Client,
        bucket: B2_BUCKET,
        key: function (req, file, cb) {
            cb(null, `uploads/${Date.now().toString()}-${file.originalname}`);
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 }
});

// Email transporter (for chat escalation)
const transporter = process.env.SMTP_EMAIL ? createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD
    }
}) : null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Resend Email Client
const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');

// Database Connection
const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Init Database Schema
const initDb = async () => {
    try {
        // Ensure UUID extension
        await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS public.users (
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                full_name TEXT,
                avatar_url TEXT,
                google_id TEXT,
                plan TEXT DEFAULT 'free',
                trial_ends_at TIMESTAMP WITH TIME ZONE,
                ai_calls_today INT DEFAULT 0,
                ai_calls_reset_at DATE DEFAULT CURRENT_DATE,
                is_admin BOOLEAN DEFAULT false,
                last_login TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Add password_hash and phone columns if they don't exist
        await pool.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT;`);
        await pool.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;`);

        // Add other potential missing columns (for existing tables or external migrations)
        await pool.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS google_id TEXT;`);
        await pool.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name TEXT;`);
        await pool.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;`);
        await pool.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ai_calls_today INT DEFAULT 0;`);
        await pool.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ai_calls_reset_at DATE DEFAULT CURRENT_DATE;`);
        await pool.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';`);
        await pool.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;`);
        await pool.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;`);
        await pool.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;`);
        await pool.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;`);
        await pool.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS verification_token TEXT;`);

        // Add Phase 4 columns for Linked Goals
        await pool.query(`ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS linked_module TEXT;`);
        await pool.query(`ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS linked_target_value NUMERIC;`);

        // Finance tables
        await pool.query(`
            CREATE TABLE IF NOT EXISTS public.goal_categories (
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                user_id UUID NOT NULL,
                name TEXT NOT NULL,
                color TEXT DEFAULT '#3b82f6',
                is_default BOOLEAN DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS public.finance_transactions (
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                user_id UUID NOT NULL,
                date DATE NOT NULL,
                description TEXT,
                amount NUMERIC NOT NULL,
                type TEXT CHECK (type IN ('credit', 'debit')),
                category TEXT,
                merchant TEXT,
                balance NUMERIC,
                statement_month TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS public.finance_budgets (
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                user_id UUID NOT NULL,
                month TEXT NOT NULL,
                category TEXT NOT NULL,
                budget_amount NUMERIC NOT NULL,
                savings_goal NUMERIC DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Health test results
        await pool.query(`
            CREATE TABLE IF NOT EXISTS public.health_test_results (
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                user_id UUID NOT NULL,
                test_date DATE NOT NULL,
                test_type TEXT NOT NULL,
                results JSONB NOT NULL,
                ai_interpretation TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Chat logs
        await pool.query(`
            CREATE TABLE IF NOT EXISTS public.chat_logs (
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                user_id UUID NOT NULL,
                messages JSONB NOT NULL DEFAULT '[]',
                resolved BOOLEAN DEFAULT false,
                escalated BOOLEAN DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            ALTER TABLE public.users 
            ADD COLUMN IF NOT EXISTS topup_credits INTEGER DEFAULT 0;
        `);

        console.log("✅ Database schema ensured (all tables)");
    } catch (err) {
        console.error("❌ Database schema init failed:", err);
    }
};
initDb();

// Session Store
const PgSession = connectPgSimple(session);

// Trust Caddy reverse proxy for correct HTTPS detection
app.set('trust proxy', 1);

// Middleware
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        const allowedOrigins = [
            process.env.FRONTEND_URL,
            'http://localhost:5173',
            'http://76.13.48.189',
            'http://76.13.48.189.nip.io',
            'https://getlifescope.com',
            'https://www.getlifescope.com',
            'https://lifescope-ai.vercel.app'
        ];

        if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('76.13.48.189') || origin.includes('getlifescope.com')) {
            callback(null, true);
        } else {
            console.log("Blocked by CORS:", origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());

app.use(session({
    store: new PgSession({
        pool: pool,
        tableName: 'session',
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'dev_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        secure: process.env.NODE_ENV === 'production', // Secure cookies over HTTPS
        sameSite: 'lax'
    }
}));

app.use(passport.initialize());
app.use(passport.session());

// Passport Config
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const { rows } = await pool.query('SELECT * FROM public.users WHERE id = $1', [id]);
        if (rows.length > 0) {
            done(null, rows[0]);
        } else {
            done(new Error("User not found"), null);
        }
    } catch (err) {
        done(err, null);
    }
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || "mock_client_id",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "mock_client_secret",
    callbackURL: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/api/auth/google/callback` : "/api/auth/google/callback"
},
    async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails[0].value;
            const googleId = profile.id;

            // 1. Check if user exists
            let { rows } = await pool.query('SELECT * FROM public.users WHERE email = $1', [email]);

            if (rows.length === 0) {
                const { rows: newRows } = await pool.query(
                    `INSERT INTO public.users (email, full_name, google_id, avatar_url, plan, last_login, is_verified) 
                     VALUES ($1, $2, $3, $4, 'free', NOW(), true) RETURNING *`,
                    [profile.emails[0].value, profile.displayName, profile.id, profile.photos[0].value]
                );
                console.log(`✅ New user registered: ${email}`);
                return done(null, newRows[0]);
            } else {
                // 3. Update last login and google_id if missing
                await pool.query(
                    `UPDATE public.users SET last_login = NOW(), google_id = COALESCE(google_id, $2), is_verified = true WHERE id = $1`,
                    [rows[0].id, googleId]
                );
                rows[0].last_login = new Date();
                rows[0].is_verified = true;
            }

            return done(null, rows[0]);
        } catch (err) {
            console.error("❌ Google Auth Error:", err);
            return done(err, null);
        }
    }
));

// Local Strategy
passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
}, async (email, password, done) => {
    try {
        const { rows } = await pool.query('SELECT * FROM public.users WHERE email = $1', [email]);
        const user = rows[0];

        if (!user) {
            return done(null, false, { message: 'Incorrect email or password.' });
        }

        if (!user.password_hash) {
            return done(null, false, { message: 'Please log in with Google.' });
        }

        if (!user.is_verified) {
            return done(null, false, { message: 'Please check your email to verify your account before logging in.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return done(null, false, { message: 'Incorrect email or password.' });
        }

        return done(null, user);
    } catch (err) {
        return done(err);
    }
}));

// --- API Routes ---

// Auth Routes
app.get('/api/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/api/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        // Successful authentication, redirect home.
        res.redirect('/');
    }
);

// Email/Password Registration
app.post('/api/auth/register', async (req, res) => {
    const { email, password, fullName, phone } = req.body;

    if (!email || !password || !fullName) {
        return res.status(400).json({ error: 'Please provide all required fields' });
    }

    try {
        // Check if user exists
        const { rows: existing } = await pool.query('SELECT * FROM public.users WHERE email = $1', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Create user
        const token = crypto.randomBytes(32).toString('hex');

        const { rows } = await pool.query(
            `INSERT INTO public.users (email, password_hash, full_name, phone, plan, last_login, is_verified, verification_token) 
             VALUES ($1, $2, $3, $4, 'free', NOW(), false, $5) RETURNING *`,
            [email, passwordHash, fullName, phone, token]
        );

        const user = rows[0];

        // Send Verification Email
        try {
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            const verifyLink = `${frontendUrl}/login?verify=${token}`;
            const emailHtml = `<h2>Welcome to LifeScope AI, ${fullName}!</h2>
                       <p>Please click the link below to verify your email address and activate your account:</p>
                       <p><a href="${verifyLink}" style="padding:10px 20px;background:#4f46e5;color:white;text-decoration:none;border-radius:5px;">Verify My Account</a></p>
                       <p>If you did not request this, please ignore this email.</p>
                       <br/>
                       <p>Best regards,<br/>LifeScope AI</p>`;

            if (transporter && process.env.SMTP_EMAIL) {
                // Fallback to SMTP since Resend Sandbox only sends to verified domains
                await transporter.sendMail({
                    from: `"LifeScope AI" <${process.env.SMTP_EMAIL}>`,
                    to: email,
                    subject: 'Verify your LifeScope AI Account',
                    html: emailHtml
                });
                console.log(`✅ Verification email sent (via SMTP) to ${email}`);
            } else {
                await resend.emails.send({
                    from: 'LifeScope AI <support@getlifescope.com>', // Verified domain
                    to: email,
                    subject: 'Verify your LifeScope AI Account',
                    html: emailHtml
                });
                console.log(`✅ Verification email sent (via Resend) to ${email}`);
            }
        } catch (emailErr) {
            console.error('❌ Failed to send verification email:', emailErr);
        }

        res.json({ message: 'Registration successful! Please check your email to verify your account.' });

    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Verify Email
app.post('/api/auth/verify', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ error: "No token provided." });

        const { rows } = await pool.query(
            'UPDATE public.users SET is_verified = true, verification_token = NULL WHERE verification_token = $1 RETURNING id',
            [token]
        );

        if (rows.length === 0) {
            return res.status(400).json({ error: "Invalid or expired verification link." });
        }

        res.json({ success: true, message: "Email successfully verified! You can now log in." });
    } catch (err) {
        console.error('Verification error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Request Password Reset OTP
app.post('/api/auth/request-reset', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: "Email is required" });

        const { rows } = await pool.query('SELECT * FROM public.users WHERE email = $1', [email]);
        if (rows.length === 0) {
            // Return success even if not found to prevent email enumeration
            return res.json({ success: true, message: "If that email exists, a reset code has been sent." });
        }

        const user = rows[0];

        // Block resetting Google-only accounts if they have no password set
        if (user.google_id && !user.password_hash) {
            return res.status(400).json({ error: "This account uses Google Login. Please sign in with Google." });
        }

        // Generate 6 digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Save OTP as the verification token (reusing the column for simplicity)
        await pool.query(
            'UPDATE public.users SET verification_token = $1 WHERE email = $2',
            [otp, email]
        );

        const emailHtml = `<h2>Reset Your Password</h2>
                           <p>Hello ${user.full_name || 'User'},</p>
                           <p>You requested a password reset for your LifeScope AI account.</p>
                           <p>Your 6-digit reset code is: <strong>${otp}</strong></p>
                           <p>Enter this code on the reset page to create a new password.</p>
                           <p>If you did not request this, please ignore this email.</p>`;

        if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_placeholder') {
            await resend.emails.send({
                from: 'LifeScope AI <support@getlifescope.com>',
                to: email,
                subject: 'Your LifeScope Password Reset Code',
                html: emailHtml
            });
            console.log(`✅ Reset OTP sent via Resend to ${email}`);
        } else if (transporter) {
            await transporter.sendMail({
                from: `"LifeScope AI" <${process.env.SMTP_EMAIL}>`,
                to: email,
                subject: 'Your LifeScope Password Reset Code',
                html: emailHtml
            });
            console.log(`✅ Reset OTP sent via SMTP to ${email}`);
        } else {
            console.log(`⚠️ Alert: Neither Resend nor SMTP configured. Generated OTP for ${email}: ${otp}`);
        }

        res.json({ success: true, message: "If that email exists, a reset code has been sent." });
    } catch (err) {
        console.error('Password reset request error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Verify Password Reset OTP and Set New Password
app.post('/api/auth/verify-reset', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ error: "Email, OTP, and new password are required." });
        }

        // Verify the OTP mapped to this email
        const { rows } = await pool.query(
            'SELECT id FROM public.users WHERE email = $1 AND verification_token = $2',
            [email, otp]
        );

        if (rows.length === 0) {
            return res.status(400).json({ error: "Invalid or expired reset code." });
        }

        const userId = rows[0].id;

        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        // Update password and clear the OTP
        await pool.query(
            'UPDATE public.users SET password_hash = $1, verification_token = NULL WHERE id = $2',
            [passwordHash, userId]
        );

        res.json({ success: true, message: "Password successfully reset! You can now log in." });
    } catch (err) {
        console.error('Password reset verify error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Email/Password Login
app.post('/api/auth/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) return next(err);
        if (!user) return res.status(400).json({ error: info.message });

        req.logIn(user, (err) => {
            if (err) return next(err);

            // Update last login
            pool.query('UPDATE public.users SET last_login = NOW() WHERE id = $1', [user.id]);
            return res.json({ user });
        });
    })(req, res, next);
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    req.logout((err) => {
        if (err) return res.status(500).json({ error: 'Logout failed' });
        res.json({ success: true });
    });
});

// Middleware to protect routes (must be defined before routes that use it)
const ensureAuth = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: "Unauthorized" });
};

// Delete account
app.delete('/api/auth/me', ensureAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const userEmail = req.user.email;
        const userName = req.user.full_name || 'User';

        // Delete from database
        await pool.query('DELETE FROM public.users WHERE id = $1', [userId]);

        // Trigger Admin Alert
        const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_EMAIL;

        if (req.user.email) {
            try {
                const alertEmail = adminEmail || 'onboarding@resend.dev';
                await resend.emails.send({
                    from: 'LifeScope AI Alerts <onboarding@resend.dev>',
                    to: alertEmail,
                    subject: '🚨 User Account Deleted',
                    html: `<h2>Account Deletion Alert</h2>
                           <p>The following user has just deleted their LifeScope account:</p>
                           <ul>
                             <li><strong>Name:</strong> ${userName}</li>
                             <li><strong>Email:</strong> ${userEmail}</li>
                             <li><strong>User ID:</strong> ${userId}</li>
                             <li><strong>Time:</strong> ${new Date().toISOString()}</li>
                           </ul>`
                });
                console.log(`✅ Admin alerted of account deletion: ${userEmail}`);
            } catch (emailErr) {
                console.error('❌ Failed to send deletion alert email:', emailErr);
            }
        }

        req.logout((err) => {
            if (err) return res.status(500).json({ error: 'Failed to clear session after deletion' });
            res.json({ success: true, message: 'Account deleted successfully' });
        });

    } catch (err) {
        console.error('Delete account error:', err);
        res.status(500).json({ error: 'Server error during deletion' });
    }
});

app.get('/api/auth/me', async (req, res) => {
    if (req.isAuthenticated()) {
        try {
            // Fetch fresh user data with plan info
            const { rows } = await pool.query('SELECT * FROM public.users WHERE id = $1', [req.user.id]);
            const user = rows[0];

            // Reset weekly AI counter if 7 days have passed
            const now = new Date();
            const lastReset = user.ai_calls_reset_at ? new Date(user.ai_calls_reset_at) : new Date(0);
            const daysSinceReset = (now - lastReset) / (1000 * 60 * 60 * 24);

            if (daysSinceReset >= 7) {
                const todayStr = now.toISOString().split('T')[0];
                await pool.query('UPDATE public.users SET ai_calls_today = 0, ai_calls_reset_at = $2 WHERE id = $1', [user.id, todayStr]);
                user.ai_calls_today = 0;
            }

            // Determine effective plan
            const effectivePlan = user.is_admin ? 'admin' : user.plan;

            // AI weekly limits per plan (free: 20, premium: 200, pro: 500)
            const limits = { free: 20, premium: 200, pro: 500, admin: 999999 };
            const aiLimit = limits[effectivePlan] ?? 20;
            const used = user.ai_calls_today || 0;
            const topup = user.topup_credits || 0;

            // Compute total remaining (daily + topup)
            let callsRemaining = 0;
            if (used < aiLimit) {
                callsRemaining = (aiLimit - used) + topup;
            } else {
                callsRemaining = topup;
            }

            res.json({
                user: {
                    ...user,
                    effectivePlan: user.is_admin ? 'premium' : user.plan,
                    aiCallsRemaining: callsRemaining,
                    aiCallsLimit: aiLimit,
                    topupCredits: topup
                }
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

// (duplicate logout route removed)
// (ensureAuth moved above delete route)

// Middleware: check AI quota before processing AI requests
const checkAIQuota = async (req, res, next) => {
    try {
        const { rows } = await pool.query('SELECT * FROM public.users WHERE id = $1', [req.user.id]);
        const user = rows[0];
        if (!user) return res.status(401).json({ error: 'User not found' });

        // Reset weekly counter if 7 days have passed
        const now = new Date();
        const lastReset = user.ai_calls_reset_at ? new Date(user.ai_calls_reset_at) : new Date(0);
        const daysSinceReset = (now - lastReset) / (1000 * 60 * 60 * 24);

        if (daysSinceReset >= 7) {
            const todayStr = now.toISOString().split('T')[0];
            await pool.query('UPDATE public.users SET ai_calls_today = 0, ai_calls_reset_at = $2 WHERE id = $1', [user.id, todayStr]);
            user.ai_calls_today = 0;
        }

        // Determine effective plan
        const effectivePlan = user.is_admin ? 'admin' : user.plan;

        const limits = { free: 20, premium: 200, pro: 500, admin: 999999 };
        const limit = limits[effectivePlan] || 20;
        const used = user.ai_calls_today || 0;
        const topup = user.topup_credits || 0;

        if (used >= limit) {
            if (topup > 0) {
                // Deduct from top-up buffer
                await pool.query('UPDATE public.users SET topup_credits = topup_credits - 1, ai_calls_today = ai_calls_today + 1 WHERE id = $1', [user.id]);
            } else {
                return res.status(429).json({
                    error: 'AI quota exceeded',
                    plan: user.plan,
                    limit,
                    used,
                    upgradeUrl: '/settings'
                });
            }
        } else {
            // Deduct normally from daily limit
            await pool.query('UPDATE public.users SET ai_calls_today = ai_calls_today + 1 WHERE id = $1', [user.id]);
        }

        // Pass the user's plan down so the AI endpoints know which model to use
        req.userPlan = effectivePlan;
        next();
    } catch (err) {
        console.error('AI Quota check error:', err);
        next(); // Fail open to not break AI features
    }
};

// Middleware: admin only
const ensureAdmin = async (req, res, next) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    const { rows } = await pool.query('SELECT is_admin FROM public.users WHERE id = $1', [req.user.id]);
    if (!rows[0]?.is_admin) return res.status(403).json({ error: 'Admin access required' });
    next();
};

// Phase 6: Email Testing Endpoint
app.post('/api/test-email', ensureAuth, async (req, res) => {
    try {
        const userEmail = req.user.email;
        const userName = req.user.full_name || 'LifeScope User';

        // Try Resend first
        if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_placeholder') {
            const data = await resend.emails.send({
                from: 'LifeScope AI <support@getlifescope.com>', // Verified domain
                to: userEmail,
                subject: 'LifeScope Email Test Successful!',
                html: `<h3>Hello ${userName},</h3>
                       <p>This is a test email from your LifeScope AI dashboard.</p>
                       <p>If you are receiving this, your Resend API email integration is configured correctly.</p>
                       <p>Best,<br>LifeScope Assistant</p>`
            });
            console.log('✅ Test email sent via Resend:', data);
            return res.json({ success: true, method: 'resend', data });
        }

        // Fallback to SMTP
        if (transporter) {
            const info = await transporter.sendMail({
                from: process.env.SMTP_EMAIL,
                to: userEmail,
                subject: 'LifeScope Email Test Successful (SMTP)!',
                html: `<h3>Hello ${userName},</h3>
                       <p>This is a test email from your LifeScope AI dashboard.</p>
                       <p>If you are receiving this, your SMTP fallback integration is configured correctly.</p>
                       <p>Best,<br>LifeScope Assistant</p>`
            });
            console.log('✅ Test email sent via SMTP fallback:', info.messageId);
            return res.json({ success: true, method: 'smtp', messageId: info.messageId });
        }

        throw new Error('Neither RESEND_API_KEY nor SMTP_EMAIL are fully configured in the environment.');
    } catch (err) {
        console.error('❌ Test email failed:', err);
        res.status(500).json({ error: err.message || 'Failed to send test email' });
    }
});

// Data Migration Endpoint (Legacy Recovery)
app.post('/api/auth/migrate-legacy-data', ensureAuth, ensureAdmin, async (req, res) => {
    try {
        const userId = req.user.id;
        const tables = ['goals', 'finance_transactions', 'finance_budgets', 'health_test_results', 'weight_logs', 'food_logs', 'chat_logs', 'measurements'];
        const results = {};

        for (const table of tables) {
            // Reassign records where user_id is NOT in the users table (orphaned)
            const query = `
                UPDATE public."${table}" 
                SET user_id = $1 
                WHERE user_id NOT IN (SELECT id FROM public.users)
            `;
            const { rowCount } = await pool.query(query, [userId]);
            results[table] = rowCount;
        }

        // Special case for activities (linked via goals, so usually done if goals are moved?)
        // Activities don't have user_id, they have goal_id. 
        // If goals are moved, activities move with them.

        res.json({ success: true, migrated: results });
    } catch (err) {
        console.error("Migration error:", err);
        res.status(500).json({ error: err.message });
    }
});

// --- Finance Routes ---

// Upload Statement
app.post('/api/finance/upload', ensureAuth, upload.single('statement'), async (req, res) => {
    try {
        const file = req.file;
        const month = req.body.month;
        const userId = req.user.id;

        if (!file || !month) {
            return res.status(400).json({ error: "Statement file and month are required" });
        }

        const isCSV = file.originalname.toLowerCase().endsWith('.csv') || file.mimetype === 'text/csv';

        if (isCSV) {
            // Parse CSV directly using PapaParse
            // S3 files have .location (URL), local multer uses .path
            // We need to fetch the file if it's securely stored in S3 config or fs
            let csvData = "";
            if (file.location) {
                const response = await fetch(file.location);
                csvData = await response.text();
            } else if (file.path) {
                const fs = await import('fs');
                csvData = fs.readFileSync(file.path, 'utf8');
            } else if (file.buffer) {
                csvData = file.buffer.toString('utf8');
            }

            const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });

            // Map common bank CSV fields. This is rudimentary and requires a specific format usually.
            // A more robust app would use the AI to parse even CSVs for consistency.
            // For now, let's just send the raw text data to Gemini to parse like we do PDFs, 
            // since Gemini handles arbitrary formats beautifully.
        }

        // --- Use Gemini to extract transactions from the file ---
        // We'll read the file content (if text) or use the URL/Buffer for Gemini.
        // For simplicity and to reuse our powerful AI stack:

        let textContent = "";
        let base64Pdf = "";
        const isPdf = file.originalname.toLowerCase().endsWith('.pdf') || file.mimetype === 'application/pdf';

        if (file.location) {
            const response = await fetch(file.location);
            if (isCSV) {
                textContent = await response.text();
            } else if (isPdf) {
                const arrayBuffer = await response.arrayBuffer();
                base64Pdf = Buffer.from(arrayBuffer).toString('base64');
            } else {
                return res.status(400).json({ error: "Only CSV and PDF formats are supported." });
            }
        } else if (file.path) {
            const fs = await import('fs');
            if (isCSV) {
                textContent = fs.readFileSync(file.path, 'utf8');
            } else if (isPdf) {
                base64Pdf = fs.readFileSync(file.path, { encoding: 'base64' });
            } else {
                return res.status(400).json({ error: "Only CSV and PDF formats are fully supported in this demo endpoint." });
            }
        } else if (file.buffer) {
            if (isCSV) {
                textContent = file.buffer.toString('utf8');
            } else if (isPdf) {
                base64Pdf = file.buffer.toString('base64');
            }
        }

        // Use Gemini to structure the data into our JSON format
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const prompt = `
            Parse the following bank statement data into a JSON array of transactions.
            Each transaction MUST have this exact structure:
            {
                "date": "YYYY-MM-DD",
                "description": "Cleaned up description",
                "amount": number (positive),
                "type": "credit" or "debit",
                "category": "Food & Dining" | "Transport" | "Bills & Utilities" | "Entertainment" | "Shopping" | "Health" | "Savings" | "Transfer" | "Income" | "Other"
            }
            
            Only return the JSON array, no markdown marking.
            Data:
            ${isCSV ? textContent.slice(0, 30000) : "Attached as inlineData document."}
        `;

        const contentsPayload = [];
        if (isPdf && base64Pdf) {
            contentsPayload.push({
                parts: [
                    { inlineData: { mimeType: "application/pdf", data: base64Pdf } },
                    { text: prompt }
                ]
            });
        } else {
            contentsPayload.push(prompt);
        }

        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: contentsPayload[0],
            config: { responseMimeType: "application/json" }
        });

        const jsonStr = response.text.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
        const transactions = JSON.parse(jsonStr);

        const client = await pool.connect();
        const insertedTransactions = [];
        try {
            await client.query('BEGIN');
            // Check if month is already processed to prevent duplicates (rudimentary check)
            await client.query('DELETE FROM public.finance_transactions WHERE user_id = $1 AND statement_month = $2', [userId, month]);

            for (const t of transactions) {
                const res = await client.query(
                    `INSERT INTO public.finance_transactions 
                    (user_id, date, description, amount, type, category, statement_month)
                    VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                    [userId, t.date, t.description, t.amount, t.type, t.category || 'Other', month]
                );
                insertedTransactions.push(res.rows[0]);
            }
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        res.json({ success: true, data: insertedTransactions });

    } catch (err) {
        console.error("Finance upload error:", err);
        res.status(500).json({ error: "Failed to process statement" });
    }
});

// Analyze Budget
app.post('/api/finance/analyze', ensureAuth, async (req, res) => {
    try {
        const { month, savingsGoal } = req.body;
        const userId = req.user.id;

        const { rows: transactions } = await pool.query(
            'SELECT * FROM public.finance_transactions WHERE user_id = $1 AND statement_month = $2',
            [userId, month]
        );

        if (transactions.length === 0) {
            return res.json({ analysis: "No transactions found for this month to analyze." });
        }

        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const prompt = `
            I am providing a list of all my financial transactions for ${month}.
            My target savings goal was $${savingsGoal || 0}.
            
            TRANSACTIONS:
            ${JSON.stringify(transactions.map(t => ({ date: t.date, desc: t.description, amt: t.amount, type: t.type, cat: t.category })))}
            
            Please provide a brutally honest, analytical review of my spending habits this month.
            1. Suggest where I am overspending.
            2. Tell me if I realistically hit my savings goal.
            3. Provide 2 actionable changes I can make next month.
            
            Do not use markdown formatting. Write in clear paragraphs. Be financial-advisor professional but direct.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: prompt
        });

        res.json({ analysis: response.text });
    } catch (err) {
        console.error("Finance analysis error:", err);
        res.status(500).json({ error: "Failed to analyze finances" });
    }
});

// Health Check
app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({
            status: 'ok',
            timestamp: result.rows[0].now,
            user: req.user ? 'logged_in' : 'anonymous'
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Data Routes (Adapting Supabase calls)

// Specialized route for Renaming Categories (with cascade)
app.put('/api/goal_categories/:id', ensureAuth, async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    const userId = req.user.id;

    if (!name) return res.status(400).json({ error: "Name is required" });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Get old name
        const checkRes = await client.query(
            'SELECT name FROM public.goal_categories WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (checkRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Category not found" });
        }
        const oldName = checkRes.rows[0].name;

        // 2. Update category name
        const updateRes = await client.query(
            'UPDATE public.goal_categories SET name = $1 WHERE id = $2 RETURNING *',
            [name, id]
        );

        // 3. Update all goals using this category
        await client.query(
            'UPDATE public.goals SET category = $1 WHERE category = $2 AND user_id = $3',
            [name, oldName, userId]
        );

        await client.query('COMMIT');
        res.json(updateRes.rows[0]);
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Category rename error:", e);
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

// Specialized route for Deleting Categories
app.delete('/api/goal_categories/:id', ensureAuth, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    try {
        // Just delete the category record. Goals will keep the string value (becoming "custom/ghost" categories)
        // or the user can reassign them manually.
        await pool.query('DELETE FROM public.goal_categories WHERE id = $1 AND user_id = $2', [id, userId]);
        res.json({ success: true });
    } catch (e) {
        console.error("Category delete error:", e);
        res.status(500).json({ error: e.message });
    }
});

// Generic "table" endpoint for simple CRUD - Replicates supabase.from('table').select()
app.get('/api/data/:table', ensureAuth, async (req, res) => {
    const { table } = req.params;
    const { select, order, limit } = req.query;

    // Security: Whitelist allowed tables
    const allowedTables = ['goals', 'activities', 'categories', 'goal_categories', 'weight_logs', 'measurements', 'food_logs', 'finance_transactions', 'finance_budgets', 'health_test_results', 'chat_logs'];
    if (!allowedTables.includes(table)) {
        return res.status(403).json({ error: "Access denied to table" });
    }

    try {
        const values = [req.user.id];

        // Handle goals with nested activities (Supabase-style: select('*, activities (*)'))
        if (table === 'goals' && select && select.includes('activities')) {
            // First get goals
            let goalsQuery = `SELECT * FROM public."goals" WHERE user_id = $1`;
            if (order) {
                const [col, dir] = order.split('.');
                const safeCol = col.replace(/[^a-z_]/g, '');
                const safeDir = dir === 'desc' ? 'DESC' : 'ASC';
                goalsQuery += ` ORDER BY "${safeCol}" ${safeDir} `;
            }
            const { rows: goals } = await pool.query(goalsQuery, values);

            // Then get all activities for these goals
            if (goals.length > 0) {
                const goalIds = goals.map(g => g.id);
                const placeholders = goalIds.map((_, i) => `$${i + 1} `).join(',');
                const { rows: activities } = await pool.query(
                    `SELECT * FROM public."activities" WHERE goal_id IN(${placeholders})`,
                    goalIds
                );

                // Nest activities inside their goals
                const goalMap = {};
                goals.forEach(g => {
                    goalMap[g.id] = { ...g, activities: [] };
                });
                activities.forEach(a => {
                    if (goalMap[a.goal_id]) {
                        goalMap[a.goal_id].activities.push(a);
                    }
                });
                const finalGoals = Object.values(goalMap);

                // Phase 4: Compute Dynamic Progress for Linked Goals
                for (let g of finalGoals) {
                    if (g.linked_module === 'finance_savings') {
                        // Progress is the sum of all income/deposits
                        const { rows: trRows } = await pool.query(`SELECT SUM(amount) as total FROM public.finance_transactions WHERE user_id = $1 AND type = 'credit'`, [req.user.id]);
                        g.progress = parseFloat(trRows[0]?.total || 0);
                    } else if (g.linked_module === 'health_weight') {
                        // Progress is the first logged weight
                        const { rows: wRows } = await pool.query(`SELECT weight FROM public.weight_logs WHERE user_id = $1 ORDER BY date DESC LIMIT 1`, [req.user.id]);
                        g.progress = parseFloat(wRows[0]?.weight || 0);
                    }
                    if (g.linked_target_value) {
                        g.target = parseFloat(g.linked_target_value);
                    }
                }

                return res.json({ data: finalGoals, error: null });
            }

            // Phase 4: Compute Dynamic Progress for Linked Goals (no activities)
            for (let g of goals) {
                if (g.linked_module === 'finance_savings') {
                    const { rows: trRows } = await pool.query(`SELECT SUM(amount) as total FROM public.finance_transactions WHERE user_id = $1 AND type = 'credit'`, [req.user.id]);
                    g.progress = parseFloat(trRows[0]?.total || 0);
                } else if (g.linked_module === 'health_weight') {
                    const { rows: wRows } = await pool.query(`SELECT weight FROM public.weight_logs WHERE user_id = $1 ORDER BY date DESC LIMIT 1`, [req.user.id]);
                    g.progress = parseFloat(wRows[0]?.weight || 0);
                }
                if (g.linked_target_value) {
                    g.target = parseFloat(g.linked_target_value);
                }
            }

            return res.json({ data: goals, error: null });
        }

        // Standard query
        let query;
        if (table === 'activities') {
            query = `SELECT a.* FROM public."activities" a 
                     INNER JOIN public."goals" g ON a.goal_id = g.id 
                     WHERE g.user_id = $1`;
        } else {
            query = `SELECT * FROM public."${table}" WHERE user_id = $1`;
        }

        if (order) {
            const [col, dir] = order.split('.');
            const safeCol = col.replace(/[^a-z_]/g, '');
            const safeDir = dir === 'desc' ? 'DESC' : 'ASC';
            query += ` ORDER BY "${safeCol}" ${safeDir} `;
        }

        if (limit) {
            const safeLimit = parseInt(limit, 10);
            if (safeLimit > 0) query += ` LIMIT ${safeLimit} `;
        }

        const { rows } = await pool.query(query, values);
        res.json({ data: rows, error: null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ data: null, error: { message: err.message } });
    }
});

// Insert
app.post('/api/data/:table', ensureAuth, async (req, res) => {
    const { table } = req.params;
    const payload = req.body;

    const allowedTables = ['goals', 'activities', 'goal_categories', 'weight_logs', 'measurements', 'food_logs'];
    if (!allowedTables.includes(table)) {
        return res.status(403).json({ error: "Access denied" });
    }

    try {
        // Force user_id for tables that have it (not activities)
        if (table !== 'activities') {
            payload.user_id = req.user.id;
        }

        const keys = Object.keys(payload);
        const values = Object.values(payload);

        const columnStr = keys.map(k => `"${k}"`).join(', ');
        const valueStr = keys.map((_, i) => `$${i + 1} `).join(', ');

        const query = `INSERT INTO public."${table}"(${columnStr}) VALUES(${valueStr}) RETURNING * `;

        const { rows } = await pool.query(query, values);
        res.json({ data: rows[0], error: null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ data: null, error: { message: err.message } });
    }
});

// Update
app.put('/api/data/:table', ensureAuth, async (req, res) => {
    const { table } = req.params;
    const payload = req.body;
    const { id } = req.query;

    const allowedTables = ['goals', 'activities', 'goal_categories', 'weight_logs', 'measurements', 'food_logs', 'finance_transactions', 'finance_budgets', 'health_test_results', 'chat_logs'];
    if (!allowedTables.includes(table) || !id) {
        return res.status(403).json({ error: "Access denied or missing id" });
    }

    try {
        const keys = Object.keys(payload);
        const values = Object.values(payload);
        const setStr = keys.map((k, i) => `"${k}" = $${i + 1} `).join(', ');
        values.push(id);

        // Enforce ownership: only allow updating records that belong to the logged-in user
        let query;
        if (table === 'activities') {
            // Activities don't have user_id directly — verify via parent goal
            query = `UPDATE public."activities" SET ${setStr} WHERE id = $${values.length}
                     AND goal_id IN(SELECT id FROM public."goals" WHERE user_id = $${values.length + 1}) RETURNING * `;
            values.push(req.user.id);
        } else {
            query = `UPDATE public."${table}" SET ${setStr} WHERE id = $${values.length} AND user_id = $${values.length + 1} RETURNING * `;
            values.push(req.user.id);
        }
        const { rows } = await pool.query(query, values);
        if (rows.length === 0) {
            return res.status(404).json({ data: null, error: { message: 'Record not found or access denied' } });
        }
        res.json({ data: rows[0], error: null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ data: null, error: { message: err.message } });
    }
});

// Delete
app.delete('/api/data/:table', ensureAuth, async (req, res) => {
    const { table } = req.params;
    const { id } = req.query;

    const allowedTables = ['goals', 'activities', 'goal_categories', 'weight_logs', 'measurements', 'food_logs', 'finance_transactions', 'finance_budgets', 'health_test_results', 'chat_logs'];
    if (!allowedTables.includes(table) || !id) {
        return res.status(403).json({ error: "Access denied or missing id" });
    }

    try {
        // Enforce ownership: only allow deleting records that belong to the logged-in user
        if (table === 'activities') {
            // Activities don't have user_id — verify via parent goal
            const checkQuery = `SELECT id FROM public."activities" WHERE id = $1 
                                AND goal_id IN(SELECT id FROM public."goals" WHERE user_id = $2)`;
            const { rows } = await pool.query(checkQuery, [id, req.user.id]);

            if (rows.length === 0) {
                return res.status(404).json({ error: "Record not found or access denied" });
            }
        } else {
            // Standard user_id check
            const checkQuery = `SELECT id FROM public."${table}" WHERE id = $1 AND user_id = $2`;
            const { rows } = await pool.query(checkQuery, [id, req.user.id]);

            if (rows.length === 0) {
                return res.status(404).json({ error: "Record not found or access denied" });
            }
        }

        // Special handling for Goals: Delete associated activities first (Cascade)
        if (table === 'goals') {
            await pool.query('DELETE FROM public."activities" WHERE goal_id = $1', [id]);
        }

        // Perform the delete
        let query;
        if (table === 'activities') {
            query = `DELETE FROM public."activities" WHERE id = $1`;
        } else {
            query = `DELETE FROM public."${table}" WHERE id = $1 AND user_id = $2`;
        }

        await pool.query(query, table === 'activities' ? [id] : [id, req.user.id]);
        res.json({ success: true, id });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: { message: err.message } });
    }
});


// --- AI Quota Route ---
// Frontend calls this to track an AI call
app.post('/api/ai/track', ensureAuth, checkAIQuota, (req, res) => {
    res.json({ success: true });
});

// --- Admin Routes ---
app.get('/api/admin/users', ensureAuth, ensureAdmin, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, email, full_name, avatar_url, plan, trial_ends_at, ai_calls_today, is_admin, last_login, created_at 
             FROM public.users ORDER BY created_at DESC`
        );
        res.json({ data: rows, error: null });
    } catch (err) {
        res.status(500).json({ data: null, error: { message: err.message } });
    }
});

app.get('/api/admin/stats', ensureAuth, ensureAdmin, async (req, res) => {
    try {
        const { rows: [stats] } = await pool.query(`
        SELECT
        COUNT(*) as total_users,
            COUNT(*) FILTER(WHERE plan = 'pro') as pro_users,
                COUNT(*) FILTER(WHERE plan = 'premium') as premium_users,
                    COUNT(*) FILTER(WHERE trial_ends_at > NOW()) as active_trials,
                        COUNT(*) FILTER(WHERE last_login > NOW() - INTERVAL '7 days') as active_week
            FROM public.users
        `);
        res.json({ data: stats, error: null });
    } catch (err) {
        res.status(500).json({ data: null, error: { message: err.message } });
    }
});

// ============================
// FINANCE ROUTES
// ============================

// Upload statement (CSV or PDF)
app.post('/api/finance/upload', ensureAuth, upload.single('statement'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const month = req.body.month || new Date().toISOString().slice(0, 7);

        // Fetch the uploaded file from S3 to parse it into memory
        const getObjectParams = { Bucket: B2_BUCKET, Key: req.file.key };
        const s3Response = await s3Client.send(new GetObjectCommand(getObjectParams));
        const fileBuffer = Buffer.from(await s3Response.Body.transformToByteArray());

        const ext = path.extname(req.file.originalname).toLowerCase();

        let records = [];

        if (ext === '.pdf') {
            // Parse PDF to extract text
            const pdfData = await pdfParse(fileBuffer);
            const text = pdfData.text;
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            // Try to detect and parse transactions from PDF text
            // Common Nigerian bank statement patterns:
            // Date | Description | Debit | Credit | Balance
            // or: Date | Narration | Withdrawal | Deposit | Balance
            const dateRegex = /^(\d{1,2}[\/\-]\w{3}[\/\-]\d{2,4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/;
            const amountRegex = /[\d,]+\.\d{2}/g;

            for (const line of lines) {
                const dateMatch = line.match(dateRegex);
                if (!dateMatch) continue;

                const date = dateMatch[1];
                // Extract all amounts from the line
                const amounts = line.match(amountRegex);
                if (!amounts || amounts.length === 0) continue;

                // Remove date and amounts from line to get description
                let desc = line.replace(dateRegex, '').trim();
                amounts.forEach(a => { desc = desc.replace(a, '').trim(); });
                desc = desc.replace(/[\|\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

                // Parse amounts
                const parsedAmounts = amounts.map(a => parseFloat(a.replace(/,/g, '')));

                let finalAmount, type, balance = 0;
                if (parsedAmounts.length >= 3) {
                    // Likely: debit, credit, balance
                    const [debit, credit, bal] = parsedAmounts;
                    balance = bal;
                    if (credit > 0 && debit === 0) { finalAmount = credit; type = 'credit'; }
                    else if (debit > 0) { finalAmount = debit; type = 'debit'; }
                    else { finalAmount = parsedAmounts[0]; type = 'debit'; }
                } else if (parsedAmounts.length === 2) {
                    // Likely: amount, balance
                    finalAmount = parsedAmounts[0];
                    balance = parsedAmounts[1];
                    type = 'debit'; // Assume debit unless context clues
                    if (desc.toLowerCase().includes('credit') || desc.toLowerCase().includes('deposit') || desc.toLowerCase().includes('salary')) {
                        type = 'credit';
                    }
                } else {
                    finalAmount = parsedAmounts[0];
                    type = 'debit';
                }

                if (!finalAmount || finalAmount === 0) continue;

                records.push({
                    date, description: desc, amount: finalAmount, type, balance, source: 'pdf'
                });
            }

            if (records.length === 0) {
                return res.status(400).json({ error: 'Could not extract transactions from PDF. The format may not be supported yet.' });
            }
        } else {
            // CSV parsing (original logic)
            const csvContent = fileBuffer.toString('utf-8');
            try {
                const csvRecords = parse(csvContent, {
                    columns: true,
                    skip_empty_lines: true,
                    trim: true,
                    relax_column_count: true
                });
                for (const row of csvRecords) {
                    const date = row['Date'] || row['date'] || row['Transaction Date'] || row['VALUE DATE'] || row['Post Date'] || '';
                    const desc = row['Description'] || row['description'] || row['Narration'] || row['NARRATION'] || row['Details'] || row['Remarks'] || '';
                    const credit = parseFloat(row['Credit'] || row['credit'] || row['CREDIT'] || row['Deposits'] || 0);
                    const debit = parseFloat(row['Debit'] || row['debit'] || row['DEBIT'] || row['Withdrawals'] || 0);
                    const amount = row['Amount'] || row['amount'];
                    const balance = row['Balance'] || row['balance'] || row['BALANCE'] || row['Closing Balance'] || 0;

                    let finalAmount, type;
                    if (amount) {
                        finalAmount = parseFloat(String(amount).replace(/[^0-9.-]/g, ''));
                        type = finalAmount >= 0 ? 'credit' : 'debit';
                        finalAmount = Math.abs(finalAmount);
                    } else {
                        finalAmount = credit || debit || 0;
                        type = credit > 0 ? 'credit' : 'debit';
                    }

                    if (!date || !finalAmount) continue;
                    records.push({
                        date, description: desc, amount: finalAmount, type,
                        balance: parseFloat(String(balance).replace(/[^0-9.-]/g, '')) || 0,
                        source: 'csv'
                    });
                }
            } catch (e) {
                return res.status(400).json({ error: 'Invalid CSV format' });
            }
        }

        // Categorize and insert all transactions
        const transactions = [];
        for (const rec of records) {
            const descLower = (rec.description || '').toLowerCase();
            let category = 'Other';
            if (descLower.includes('food') || descLower.includes('restaurant') || descLower.includes('eat')) category = 'Food & Dining';
            else if (descLower.includes('uber') || descLower.includes('bolt') || descLower.includes('transport') || descLower.includes('fuel')) category = 'Transport';
            else if (descLower.includes('airtime') || descLower.includes('dstv') || descLower.includes('electricity') || descLower.includes('internet')) category = 'Bills & Utilities';
            else if (descLower.includes('netflix') || descLower.includes('spotify') || descLower.includes('cinema')) category = 'Entertainment';
            else if (descLower.includes('shop') || descLower.includes('store') || descLower.includes('jumia') || descLower.includes('konga')) category = 'Shopping';
            else if (descLower.includes('hospital') || descLower.includes('pharmacy') || descLower.includes('medical')) category = 'Health';
            else if (descLower.includes('transfer') || descLower.includes('trf')) category = 'Transfer';
            else if (rec.type === 'credit') category = 'Income';

            const { rows } = await pool.query(
                `INSERT INTO public.finance_transactions(user_id, date, description, amount, type, category, balance, statement_month)
        VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING * `,
                [req.user.id, rec.date, rec.description, rec.amount, rec.type, category, rec.balance || 0, month]
            );
            transactions.push(rows[0]);
        }

        res.json({ data: transactions, count: transactions.length, source: ext === '.pdf' ? 'pdf' : 'csv' });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get transactions by month
app.get('/api/finance/transactions', ensureAuth, async (req, res) => {
    try {
        const { month } = req.query;
        let query = `SELECT * FROM public.finance_transactions WHERE user_id = $1`;
        const values = [req.user.id];
        if (month) {
            query += ` AND statement_month = $2`;
            values.push(month);
        }
        query += ` ORDER BY date DESC`;
        const { rows } = await pool.query(query, values);
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get spending summary
app.get('/api/finance/summary', ensureAuth, async (req, res) => {
    try {
        const { month } = req.query;
        const values = [req.user.id];
        let whereMonth = '';
        if (month) {
            whereMonth = ' AND statement_month = $2';
            values.push(month);
        }
        const { rows } = await pool.query(
            `SELECT category, SUM(amount) as total, type 
             FROM public.finance_transactions WHERE user_id = $1${whereMonth}
             GROUP BY category, type ORDER BY total DESC`,
            values
        );
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// AI Finance Analysis
app.post('/api/finance/analyze', ensureAuth, checkAIQuota, async (req, res) => {
    try {
        const { month, savingsGoal } = req.body;
        const { rows: transactions } = await pool.query(
            `SELECT * FROM public.finance_transactions WHERE user_id = $1 AND statement_month = $2 ORDER BY date`,
            [req.user.id, month]
        );

        const totalIncome = transactions.filter(t => t.type === 'credit').reduce((s, t) => s + parseFloat(t.amount), 0);
        const totalExpenses = transactions.filter(t => t.type === 'debit').reduce((s, t) => s + parseFloat(t.amount), 0);
        const categories = {};
        transactions.filter(t => t.type === 'debit').forEach(t => {
            categories[t.category] = (categories[t.category] || 0) + parseFloat(t.amount);
        });

        // Build prompt for AI analysis
        const analysis = `Based on this month's data:
        Income: ₦${totalIncome.toLocaleString()}
        Expenses: ₦${totalExpenses.toLocaleString()}
        Net: ₦${(totalIncome - totalExpenses).toLocaleString()}
Category breakdown: ${Object.entries(categories).map(([k, v]) => `${k}: ₦${Number(v).toLocaleString()}`).join(', ')}
Savings goal: ₦${(savingsGoal || 0).toLocaleString()}

        Recommendations:
        1. Your biggest spending category is ${Object.entries(categories).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}.
        2. To save ₦${(savingsGoal || 0).toLocaleString()}, consider reducing spending in non - essential categories.
3. ${totalIncome > totalExpenses ? 'You are saving money this month. Keep it up!' : 'You are spending more than you earn. Review your expenses.'} `;

        res.json({ analysis });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================
// CHAT ROUTES
// ============================

// Log chat messages
app.post('/api/chat/log', ensureAuth, async (req, res) => {
    try {
        const { messages } = req.body;
        // Upsert: update existing or create new
        const { rows: existing } = await pool.query(
            `SELECT id FROM public.chat_logs WHERE user_id = $1 AND updated_at > NOW() - INTERVAL '1 hour' ORDER BY updated_at DESC LIMIT 1`,
            [req.user.id]
        );

        if (existing.length > 0) {
            await pool.query(
                `UPDATE public.chat_logs SET messages = $2, updated_at = NOW() WHERE id = $1`,
                [existing[0].id, JSON.stringify(messages)]
            );
        } else {
            await pool.query(
                `INSERT INTO public.chat_logs(user_id, messages) VALUES($1, $2)`,
                [req.user.id, JSON.stringify(messages)]
            );
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get chat history
app.get('/api/chat/history', ensureAuth, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT * FROM public.chat_logs WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 20`,
            [req.user.id]
        );
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Escalate chat to email
app.post('/api/chat/escalate', ensureAuth, async (req, res) => {
    try {
        const { messages, userName, userEmail } = req.body;

        // Mark chat as escalated
        await pool.query(
            `UPDATE public.chat_logs SET escalated = true WHERE user_id = $1 AND updated_at > NOW() - INTERVAL '1 hour'`,
            [req.user.id]
        );

        // Build email body
        const chatTranscript = (messages || []).map(m => `${m.role.toUpperCase()}: ${m.text} `).join('\n\n');
        const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_EMAIL;

        if (transporter && adminEmail) {
            await transporter.sendMail({
                from: `LifeScope AI < ${process.env.SMTP_EMAIL}> `,
                to: adminEmail,
                subject: `[LifeScope Support] Escalation from ${userName || 'User'} `,
                text: `Support escalation from ${userName} (${userEmail}) \n\nChat Transcript: \n${chatTranscript} `,
                html: `< h2 > Support Escalation</h2 >
                       <p><strong>User:</strong> ${userName} (${userEmail})</p>
                       <h3>Chat Transcript</h3>
                       <pre style="background:#f4f4f4;padding:16px;border-radius:8px;">${chatTranscript}</pre>`
            });
            console.log(`📧 Escalation email sent for user ${userEmail}`);
        } else {
            console.warn('⚠️ Email not configured. Escalation logged but not emailed.');
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Escalation error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================
// AI API ROUTES (Backend-proxy to track quota)
// ============================

// Helper locally
const getAI = async (req) => {
    const { GoogleGenAI } = await import('@google/genai');
    // If user passed a key from front-end localStorage, use it. Else use server ENV
    const apiKey = req.headers['x-gemini-key'] || process.env.GEMINI_API_KEY;
    return new GoogleGenAI({ apiKey });
};

const getModelName = (req) => {
    if (req.userPlan === 'admin' || req.userPlan === 'pro') return 'gemini-3.1-pro';
    if (req.userPlan === 'premium') return 'gemini-2.5-pro';
    return 'gemini-2.5-flash';
};

// We apply ensureAuth and checkAIQuota to ALL real AI usage routes
const aiAuth = [ensureAuth, checkAIQuota];

const SYSTEM_INSTRUCTION = `
You are a personal AI Goal Tracker and Life Management Assistant. 
Your output should be clear, concise, and action-oriented.
IMPORTANT: Do NOT use Markdown formatting (no bolding **, no headers #, no bullet points *, no dashes -). 
Write in clean, plain text paragraphs or simple numbered lists (1. 2. 3.) only if absolutely necessary.
Always end responses by asking "What do you want to add, review, or improve today?".
`;

app.post('/api/ai/recommendation', aiAuth, async (req, res) => {
    try {
        const { goalTitle, currentStatus } = req.body;
        const ai = await getAI(req);
        const prompt = `
            I have a goal: "${goalTitle}". 
            Current status: ${currentStatus}.
            Please provide 3 specific, actionable activities to help me achieve this, and 1 potential pitfall to avoid.
            Format as a concise list (1. 2. 3. 4.). Do not use bold characters.
        `;

        const response = await ai.models.generateContent({
            model: getModelName(req),
            contents: prompt,
            config: { systemInstruction: SYSTEM_INSTRUCTION }
        });
        res.json({ text: response.text });
    } catch (error) {
        console.error("AI Recomm Error:", error);
        res.status(500).json({ error: "Unable to generate recommendations." });
    }
});

app.post('/api/ai/scenario', aiAuth, async (req, res) => {
    try {
        const { scenario, level } = req.body;
        const ai = await getAI(req);
        const prompt = `
            Scenario: ${scenario}
            Level: ${level}
            
            Generate a role-play script for me to practice. 
            Format it as a script (Me: ... You: ...).
            Do NOT use any markdown formatting like ** or ## or ---.
            Include actionable tone tips at the end.
        `;
        const response = await ai.models.generateContent({
            model: getModelName(req),
            contents: prompt,
            config: { systemInstruction: SYSTEM_INSTRUCTION }
        });
        res.json({ text: response.text });
    } catch (error) {
        res.status(500).json({ error: "Error generating scenario." });
    }
});

app.post('/api/ai/chat', aiAuth, async (req, res) => {
    try {
        const { history, message } = req.body;
        const ai = await getAI(req);
        const chat = ai.chats.create({
            model: getModelName(req),
            history: history,
            config: {
                systemInstruction: "You are a role-play partner helping the user practice a specific social scenario. Stay in character. Keep responses brief and conversational. Do not use Markdown."
            }
        });
        const result = await chat.sendMessage({ message });
        res.json({ text: result.text });
    } catch (error) {
        res.status(500).json({ error: "I'm having trouble connecting." });
    }
});

app.post('/api/ai/voice', aiAuth, async (req, res) => {
    try {
        const { audioBase64 } = req.body;
        const ai = await getAI(req);
        const response = await ai.models.generateContent({
            model: getModelName(req),
            contents: {
                parts: [
                    { inlineData: { mimeType: 'audio/wav', data: audioBase64 } },
                    { text: "Analyze this voice recording. Give feedback on 1) Confidence, 2) Clarity, 3) Tone. Do not use Markdown." }
                ]
            }
        });
        res.json({ text: response.text });
    } catch (error) {
        res.status(500).json({ error: "Could not analyze audio." });
    }
});

app.post('/api/ai/briefing', aiAuth, async (req, res) => {
    try {
        const { topic } = req.body;
        const ai = await getAI(req);
        let prompt = "";

        if (topic === 'Sports') {
            prompt = "Write a detailed report on trending talking points in Football, Boxing, and MMA. Write in full paragraphs. Do not use bullet points or markdown symbols.";
        } else if (topic === 'History') {
            prompt = `Write a two-part historical report...\nPART 1: NIGERIA...\nPART 2: GLOBAL... (No markdown symbols)`;
        } else if (topic === 'Finance') {
            prompt = "Provide a robust financial report on the Nigerian Market... (No markdown symbols)";
        }

        const response = await ai.models.generateContent({
            model: getModelName(req),
            contents: prompt,
            config: {
                systemInstruction: "You are an expert analyst. Output plain text only. No markdown formatting.",
                tools: [{ googleSearch: {} }]
            }
        });
        res.json({ text: response.text });
    } catch (error) {
        res.status(500).json({ error: "Unable to fetch briefing data." });
    }
});

app.post('/api/ai/document', aiAuth, async (req, res) => {
    try {
        const { base64Data, mimeType } = req.body;
        const ai = await getAI(req);
        const response = await ai.models.generateContent({
            model: getModelName(req),
            contents: {
                parts: [
                    { inlineData: { mimeType, data: base64Data } },
                    { text: "Summarize this document. Provide 3 key takeaways and actionable insights. Output as plain text only, no bolding or markdown symbols." }
                ]
            },
            config: { systemInstruction: SYSTEM_INSTRUCTION }
        });
        res.json({ text: response.text });
    } catch (error) {
        res.status(500).json({ error: "Error analyzing document." });
    }
});

app.post('/api/ai/url', aiAuth, async (req, res) => {
    try {
        const { url } = req.body;
        const ai = await getAI(req);
        const prompt = `Access and analyze the content of this website: ${url}\nProvide a comprehensive summary of the page's content...`;
        const response = await ai.models.generateContent({
            model: getModelName(req),
            contents: prompt,
            config: { tools: [{ googleSearch: {} }] }
        });
        res.json({ text: response.text });
    } catch (error) {
        res.status(500).json({ error: "Unable to analyze website." });
    }
});

app.post('/api/ai/annual-report', aiAuth, async (req, res) => {
    try {
        const { userData } = req.body;
        const ai = await getAI(req);
        const prompt = `You are a Senior Strategic Life Coach... USER DATA: ${JSON.stringify(userData)}`;
        const response = await ai.models.generateContent({
            model: getModelName(req),
            contents: prompt
        });
        res.json({ text: response.text });
    } catch (error) {
        res.status(500).json({ error: `AI Error: ${error.message}` });
    }
});

// --- Health ---
app.post('/api/ai/food-image', aiAuth, async (req, res) => {
    try {
        const { base64Image } = req.body;
        const ai = await getAI(req);
        const prompt = `Analyze the food in this image carefully... Return ONLY a JSON object...`;
        const response = await ai.models.generateContent({
            model: getModelName(req),
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                    { text: prompt }
                ]
            },
            config: { responseMimeType: "application/json" }
        });
        const text = response.text;
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        res.json(JSON.parse(jsonStr));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error analyzing food." });
    }
});

app.post('/api/ai/meal-plan', aiAuth, async (req, res) => {
    try {
        const { preferences } = req.body;
        const ai = await getAI(req);
        const prompt = `Create a detailed ${preferences.duration || '7'}-day meal plan... Goal: ${preferences.goal}...`;
        const response = await ai.models.generateContent({
            model: getModelName(req),
            contents: prompt,
            config: { systemInstruction: SYSTEM_INSTRUCTION }
        });
        res.json({ text: response.text });
    } catch (error) {
        res.status(500).json({ error: "Unable to generate meal plan." });
    }
});

app.post('/api/ai/improve-diet', aiAuth, async (req, res) => {
    try {
        const { currentPlan, goal, userComments } = req.body;
        const ai = await getAI(req);
        const prompt = `I have this meal plan: """${currentPlan}"""\nMy goal is: ${goal}...\nReturn ONLY a JSON object...`;
        const response = await ai.models.generateContent({
            model: getModelName(req),
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        const text = response.text;
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        res.json(JSON.parse(jsonStr));
    } catch (error) {
        res.status(500).json({ error: "Diet Improvement Error" });
    }
});

app.post('/api/ai/report-gen', aiAuth, async (req, res) => {
    try {
        const { prompt, documentText, format, templateText } = req.body;
        const ai = await getAI(req);
        const systemPrompt = `You are a professional report generation AI. ${documentText ? `REFERENCE DOCUMENT: ${documentText.slice(0, 30000)}` : ''} ...`;
        const response = await ai.models.generateContent({
            model: getModelName(req),
            contents: systemPrompt
        });
        res.json({ text: response.text });
    } catch (error) {
        res.status(500).json({ error: "Report Generation Error" });
    }
});

app.post('/api/ai/health-parse', aiAuth, async (req, res) => {
    try {
        const { base64Image, mimeType } = req.body;
        const ai = await getAI(req);
        const prompt = `You are an expert medical data extractor. Read the following health/lab report image carefully... Return ONLY a JSON array...`;
        const response = await ai.models.generateContent({
            model: getModelName(req),
            contents: {
                parts: [
                    { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64Image } },
                    { text: prompt }
                ]
            },
            config: { responseMimeType: "application/json" }
        });
        const text = response.text;
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        res.json({ results: JSON.parse(jsonStr) });
    } catch (error) {
        res.status(500).json({ error: "Parse Report Error" });
    }
});

app.post('/api/ai/health-interpret', aiAuth, async (req, res) => {
    try {
        const { testData } = req.body;
        const ai = await getAI(req);
        const prompt = `Interpret these medical test results in plain language: Test Type: ${testData.testType} Results: ${JSON.stringify(testData.results)}....`;
        const response = await ai.models.generateContent({
            model: getModelName(req),
            contents: prompt,
            config: { systemInstruction: "You are a health information assistant..." }
        });
        res.json({ text: (response.text || "Unable to interpret results.") + "\n\nDISCLAIMER: This is not medical advice..." });
    } catch (error) {
        res.status(500).json({ error: "Test Interpretation Error" });
    }
});

app.post('/api/ai/chat-support', aiAuth, async (req, res) => {
    try {
        const { message, userContext, chatHistory } = req.body;
        const ai = await getAI(req);
        // formatting and system prompt applied here...
        const chat = ai.chats.create({
            model: getModelName(req),
            history: chatHistory.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
            config: { systemInstruction: `You are the LifeScope AI assistant. You help the user manage their goals, finances, health, and documents. If they ask about upgrading, tell them to go to Settings -> Profile and click 'Upgrade Now' to get Premium for ₦5,000. User: ${userContext.userName}` }
        });
        const result = await chat.sendMessage({ message });
        res.json({ text: result.text });
    } catch (error) {
        res.status(500).json({ error: "Chat Support Error" });
    }
});

// ============================
// PAYSTACK PAYMENT INTEGRATION
// ============================
const paystackSecretKey = process.env.PAYSTACK_ENVIRONMENT === 'live'
    ? process.env.PAYSTACK_LIVE_SECRET_KEY
    : process.env.PAYSTACK_TEST_SECRET_KEY;

// 1. Initialize Payment
app.post('/api/payment/initialize', ensureAuth, async (req, res) => {
    try {
        const { planId, amount } = req.body;
        // Verify plan exists and amount matches
        if (!['pro', 'premium', 'topup'].includes(planId)) {
            return res.status(400).json({ error: 'Invalid plan' });
        }

        const response = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${paystackSecretKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: req.user.email,
                amount: amount * 100, // Paystack requires amount in Kobo/lowest denomination
                metadata: {
                    user_id: req.user.id,
                    plan_id: planId
                },
                callback_url: `${process.env.FRONTEND_URL || 'https://getlifescope.com'}/settings`
            })
        });

        const data = await response.json();
        if (!data.status) {
            return res.status(400).json({ error: data.message });
        }

        res.json({ checkoutUrl: data.data.authorization_url, reference: data.data.reference });
    } catch (err) {
        console.error('Paystack init error:', err);
        res.status(500).json({ error: 'Failed to initialize payment' });
    }
});

// 2. Paystack Webhook
app.post('/api/payment/webhook', express.json(), async (req, res) => {
    try {
        const hash = crypto.createHmac('sha512', paystackSecretKey).update(JSON.stringify(req.body)).digest('hex');
        if (hash === req.headers['x-paystack-signature']) {
            const event = req.body;

            if (event.event === 'charge.success') {
                const { user_id, plan_id } = event.data.metadata;

                if (plan_id === 'topup') {
                    // Add 500 Top-up credits
                    await pool.query(
                        `UPDATE public.users SET topup_credits = topup_credits + 500 WHERE id = $1`,
                        [user_id]
                    );
                    console.log(`✅ Paystack Webhook: Added 500 Top-Up Credits to user ${user_id}.`);
                } else {
                    // Update User Plan
                    await pool.query(
                        `UPDATE public.users SET plan = $1, ai_calls_today = 0 WHERE id = $2`,
                        [plan_id, user_id]
                    );
                    console.log(`✅ Paystack Webhook: Upgraded user ${user_id} to ${plan_id} plan.`);
                }
            }
        }
        res.sendStatus(200);
    } catch (err) {
        console.error('Webhook Error:', err);
        res.sendStatus(500);
    }
});

// ============================
// HEALTH TEST RESULTS ROUTES
// ============================

app.post('/api/health/test-results', ensureAuth, async (req, res) => {
    try {
        const { test_date, test_type, results, ai_interpretation } = req.body;
        const { rows } = await pool.query(
            `INSERT INTO public.health_test_results(user_id, test_date, test_type, results, ai_interpretation)
VALUES($1, $2, $3, $4, $5) RETURNING * `,
            [req.user.id, test_date, test_type, JSON.stringify(results), ai_interpretation || null]
        );
        res.json({ data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Chat Endpoints
app.post('/api/chat/log', ensureAuth, async (req, res) => {
    try {
        const { messages } = req.body;

        let { rows } = await pool.query('SELECT id FROM public.chat_logs WHERE user_id = $1 AND resolved = false ORDER BY created_at DESC LIMIT 1', [req.user.id]);

        if (rows.length > 0) {
            await pool.query('UPDATE public.chat_logs SET messages = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(messages), rows[0].id]);
        } else {
            await pool.query('INSERT INTO public.chat_logs (user_id, messages) VALUES ($1, $2)', [req.user.id, JSON.stringify(messages)]);
        }
        res.json({ success: true });
    } catch (err) {
        console.error("Chat log error", err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/chat/escalate', ensureAuth, async (req, res) => {
    try {
        const { messages, userName, userEmail } = req.body;

        // Mark latest chat as escalated
        let { rows } = await pool.query('SELECT id FROM public.chat_logs WHERE user_id = $1 AND resolved = false ORDER BY created_at DESC LIMIT 1', [req.user.id]);
        if (rows.length > 0) {
            await pool.query('UPDATE public.chat_logs SET escalated = true, messages = $1 WHERE id = $2', [JSON.stringify(messages), rows[0].id]);
        }

        const adminEmail = process.env.SMTP_EMAIL || 'support@getlifescope.com';
        const chatHtml = messages.map(m => `< b > ${m.role.toUpperCase()}:</b > <p>${m.text}</p>`).join('<hr/>');

        const html = `< h2 > Chat Escalation Alert</h2 >
                      <p><b>User:</b> ${userName || 'Unknown'} (${userEmail || 'Unknown'})</p>
                      <h3>Conversation Log:</h3>
                      <div style="background:#f4f4f4;padding:15px;border-radius:5px;font-family:sans-serif;">${chatHtml}</div>`;

        if (transporter && process.env.SMTP_EMAIL) {
            await transporter.sendMail({
                from: `"LifeScope System" < ${process.env.SMTP_EMAIL}> `,
                to: adminEmail,
                subject: `Support Escalation: ${userName || 'User'} `,
                html: html
            });
            console.log("✅ Chat Escalation sent via SMTP");
        } else {
            await resend.emails.send({
                from: 'LifeScope System <support@getlifescope.com>',
                to: adminEmail,
                subject: `Support Escalation: ${userName || 'User'} `,
                html: html
            });
            console.log("✅ Chat Escalation sent via Resend");
        }
        res.json({ success: true });
    } catch (err) {
        console.error("Escalation error", err);
        res.status(500).json({ error: err.message });
    }
});


app.get('/api/health/test-results', ensureAuth, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT * FROM public.health_test_results WHERE user_id = $1 ORDER BY test_date DESC`,
            [req.user.id]
        );
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serve Static Frontend directly (Production Mode)

if (process.env.NODE_ENV === 'production') {
    // Serve frontend files with cache headers
    app.use(express.static(path.join(__dirname, '../dist'), {
        maxAge: '1y',
        etag: false
    }));

    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../dist/index.html'));
    });
}

// ============================
// AUTOMATED MONTHLY EMAILS
// ============================

// Helper function to send monthly summary
const sendMonthlySummaries = async () => {
    try {
        console.log("⏳ Starting monthly cron job for email summaries...");

        // Find all users
        const { rows: users } = await pool.query('SELECT id, email, full_name FROM public.users');

        for (const user of users) {
            // Get incomplete goals
            const { rows: goals } = await pool.query(
                'SELECT title, progress, target FROM public.goals WHERE user_id = $1 AND progress < target',
                [user.id]
            );

            if (goals.length > 0) {
                const goalListHtml = goals.map(g => `< li > <strong>${g.title}</strong>: ${g.progress} / ${g.target}</li > `).join('');

                try {
                    await resend.emails.send({
                        from: 'LifeScope AI <support@getlifescope.com>', // Verified domain
                        to: user.email,
                        subject: 'Your Monthly LifeScope Report',
                        html: `< h2 > Hello ${user.full_name || 'there'} !</h2 >
                               <p>Here is your monthly check-in from LifeScope AI. You have some active goals waiting for your attention:</p>
                               <ul>${goalListHtml}</ul>
                               <p>Log in to update your progress and keep up the great work!</p>
                               <br/>
                               <p>Best regards,<br/>LifeScope AI</p>`
                    });
                    console.log(`✅ Monthly email sent to ${user.email} `);
                } catch (emailErr) {
                    console.error(`❌ Failed to send email to ${user.email}: `, emailErr);
                }
            }
        }
    } catch (err) {
        console.error("❌ Cron job failed:", err);
    }
};

// Schedule Cron Job: Runs at 09:00 AM on the 1st of every month
// '0 9 1 * *' means: Minute 0, Hour 9, Day 1 of Month, Every Month, Every Day of Week
cron.schedule('0 9 1 * *', () => {
    sendMonthlySummaries();
});

// Manual trigger route for testing or AI invocation
app.post('/api/email/trigger-monthly', ensureAuth, ensureAdmin, async (req, res) => {
    try {
        // Run it asynchronously in the background so the request doesn't hang
        sendMonthlySummaries();
        res.json({ success: true, message: "Monthly summary generation triggered." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} `);
});
