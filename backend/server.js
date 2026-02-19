import express from 'express';
import session from 'express-session';
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
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import compression from 'compression';

dotenv.config();

// File upload config
const upload = multer({ dest: 'uploads/', limits: { fileSize: 5 * 1024 * 1024 } });

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
const PORT = process.env.PORT || 3000;

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

        // Add other potential missing columns (for existing tables)
        await pool.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ai_calls_today INT DEFAULT 0;`);
        await pool.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ai_calls_reset_at DATE DEFAULT CURRENT_DATE;`);
        await pool.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';`);
        await pool.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;`);
        await pool.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;`);
        await pool.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;`);


        // Finance tables
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

        console.log("✅ Database schema ensured (all tables)");
    } catch (err) {
        console.error("❌ Database schema init failed:", err);
    }
};
initDb();

// Session Store
const PgSession = connectPgSimple(session);

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
            'https://lifescope-ai.vercel.app'
        ];

        if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('76.13.48.189')) {
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
        secure: false // Allow HTTP for now (VPS is not HTTPS)
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
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback"
},
    async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails[0].value;
            const googleId = profile.id;

            // 1. Check if user exists
            let { rows } = await pool.query('SELECT * FROM public.users WHERE email = $1', [email]);

            if (rows.length === 0) {
                // 2. Create new user with 7-day trial
                const trialEnd = new Date();
                trialEnd.setDate(trialEnd.getDate() + 7);

                const result = await pool.query(
                    `INSERT INTO public.users (email, full_name, avatar_url, google_id, plan, trial_ends_at, last_login) 
                     VALUES ($1, $2, $3, $4, 'free', $5, NOW()) RETURNING *`,
                    [email, profile.displayName, profile.photos[0]?.value, googleId, trialEnd]
                );
                rows = result.rows;
                console.log(`✅ New user registered: ${email} (trial until ${trialEnd.toLocaleDateString()})`);
            } else {
                // 3. Update last login and google_id if missing
                await pool.query(
                    `UPDATE public.users SET last_login = NOW(), google_id = COALESCE(google_id, $2) WHERE id = $1`,
                    [rows[0].id, googleId]
                );
                rows[0].last_login = new Date();
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
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 7);

        const { rows } = await pool.query(
            `INSERT INTO public.users (email, password_hash, full_name, phone, plan, trial_ends_at, last_login) 
             VALUES ($1, $2, $3, $4, 'free', $5, NOW()) RETURNING *`,
            [email, passwordHash, fullName, phone, trialEnd]
        );

        const user = rows[0];

        // Auto login
        req.login(user, (err) => {
            if (err) throw err;
            res.json({ user });
        });

    } catch (err) {
        console.error('Registration error:', err);
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

app.get('/api/auth/me', async (req, res) => {
    if (req.isAuthenticated()) {
        // Fetch fresh user data with plan info
        const { rows } = await pool.query('SELECT * FROM public.users WHERE id = $1', [req.user.id]);
        const user = rows[0];

        // Reset daily AI counter if needed
        const today = new Date().toISOString().split('T')[0];
        if (user.ai_calls_reset_at?.toISOString?.()?.split('T')[0] !== today) {
            await pool.query('UPDATE public.users SET ai_calls_today = 0, ai_calls_reset_at = $2 WHERE id = $1', [user.id, today]);
            user.ai_calls_today = 0;
        }

        // Determine effective plan (trial = pro features)
        const now = new Date();
        const inTrial = user.trial_ends_at && new Date(user.trial_ends_at) > now;
        const effectivePlan = user.is_admin ? 'premium' : (inTrial ? 'pro' : user.plan);

        // AI limits per plan (admin gets 'premium' effectivePlan so is always unlimited)
        const limits = { free: 10, pro: 50, premium: 999999 };
        const aiLimit = limits[effectivePlan] ?? 10;

        res.json({
            user: {
                ...user,
                effectivePlan,
                aiCallsRemaining: Math.max(0, aiLimit - (user.ai_calls_today || 0)),
                aiCallsLimit: aiLimit,
                trialActive: !!inTrial,
                trialDaysLeft: inTrial ? Math.ceil((new Date(user.trial_ends_at) - now) / (1000 * 60 * 60 * 24)) : 0
            }
        });
    } else {
        res.status(401).json({ user: null });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.logout((err) => {
        if (err) return res.status(500).json({ error: "Logout failed" });
        return res.json({ success: true });
    });
});

// Middleware to protect routes
const ensureAuth = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: "Unauthorized" });
};

// Middleware: check AI quota before processing AI requests
const checkAIQuota = async (req, res, next) => {
    try {
        const { rows } = await pool.query('SELECT * FROM public.users WHERE id = $1', [req.user.id]);
        const user = rows[0];
        if (!user) return res.status(401).json({ error: 'User not found' });

        // Reset daily counter if needed
        const today = new Date().toISOString().split('T')[0];
        if (user.ai_calls_reset_at?.toISOString?.()?.split('T')[0] !== today) {
            await pool.query('UPDATE public.users SET ai_calls_today = 0, ai_calls_reset_at = $2 WHERE id = $1', [user.id, today]);
            user.ai_calls_today = 0;
        }

        // Determine effective plan
        const now = new Date();
        const inTrial = user.trial_ends_at && new Date(user.trial_ends_at) > now;
        const effectivePlan = user.is_admin ? 'premium' : (inTrial ? 'pro' : user.plan);

        const limits = { free: 10, pro: 50, premium: 999999 };
        const limit = limits[effectivePlan] || 0;

        if ((user.ai_calls_today || 0) >= limit) {
            return res.status(429).json({
                error: 'AI quota exceeded',
                plan: effectivePlan,
                limit,
                used: user.ai_calls_today,
                upgradeUrl: '/settings'
            });
        }

        // Increment counter
        await pool.query('UPDATE public.users SET ai_calls_today = ai_calls_today + 1 WHERE id = $1', [user.id]);
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

// Data Migration Endpoint (Legacy Recovery)
app.post('/api/auth/migrate-legacy-data', ensureAuth, async (req, res) => {
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
// Generic "table" endpoint for simple CRUD - Replicates supabase.from('table').select()
app.get('/api/data/:table', ensureAuth, async (req, res) => {
    const { table } = req.params;
    const { select, order, limit } = req.query;

    // Security: Whitelist allowed tables
    const allowedTables = ['goals', 'activities', 'categories', 'weight_logs', 'measurements', 'food_logs', 'finance_transactions', 'finance_budgets', 'health_test_results', 'chat_logs'];
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
                goalsQuery += ` ORDER BY "${safeCol}" ${safeDir}`;
            }
            const { rows: goals } = await pool.query(goalsQuery, values);

            // Then get all activities for these goals
            if (goals.length > 0) {
                const goalIds = goals.map(g => g.id);
                const placeholders = goalIds.map((_, i) => `$${i + 1}`).join(',');
                const { rows: activities } = await pool.query(
                    `SELECT * FROM public."activities" WHERE goal_id IN (${placeholders})`,
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
                return res.json({ data: Object.values(goalMap), error: null });
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
            query += ` ORDER BY "${safeCol}" ${safeDir}`;
        }

        if (limit) {
            const safeLimit = parseInt(limit, 10);
            if (safeLimit > 0) query += ` LIMIT ${safeLimit}`;
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

    const allowedTables = ['goals', 'activities', 'weight_logs', 'measurements', 'food_logs'];
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
        const valueStr = keys.map((_, i) => `$${i + 1}`).join(', ');

        const query = `INSERT INTO public."${table}" (${columnStr}) VALUES (${valueStr}) RETURNING *`;

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

    const allowedTables = ['goals', 'activities', 'weight_logs', 'measurements', 'food_logs', 'finance_transactions', 'finance_budgets', 'health_test_results', 'chat_logs'];
    if (!allowedTables.includes(table) || !id) {
        return res.status(403).json({ error: "Access denied or missing id" });
    }

    try {
        const keys = Object.keys(payload);
        const values = Object.values(payload);
        const setStr = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        values.push(id);

        const query = `UPDATE public."${table}" SET ${setStr} WHERE id = $${values.length} RETURNING *`;
        const { rows } = await pool.query(query, values);
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

    const allowedTables = ['goals', 'activities', 'weight_logs', 'measurements', 'food_logs', 'finance_transactions', 'finance_budgets', 'health_test_results', 'chat_logs'];
    if (!allowedTables.includes(table) || !id) {
        return res.status(403).json({ error: "Access denied or missing id" });
    }

    try {
        await pool.query(`DELETE FROM public."${table}" WHERE id = $1`, [id]);
        res.json({ error: null });
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
                COUNT(*) FILTER (WHERE plan = 'pro') as pro_users,
                COUNT(*) FILTER (WHERE plan = 'premium') as premium_users,
                COUNT(*) FILTER (WHERE trial_ends_at > NOW()) as active_trials,
                COUNT(*) FILTER (WHERE last_login > NOW() - INTERVAL '7 days') as active_week
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
        const fileBuffer = readFileSync(req.file.path);
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
                `INSERT INTO public.finance_transactions (user_id, date, description, amount, type, category, balance, statement_month)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
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
2. To save ₦${(savingsGoal || 0).toLocaleString()}, consider reducing spending in non-essential categories.
3. ${totalIncome > totalExpenses ? 'You are saving money this month. Keep it up!' : 'You are spending more than you earn. Review your expenses.'}`;

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
                `INSERT INTO public.chat_logs (user_id, messages) VALUES ($1, $2)`,
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
        const chatTranscript = (messages || []).map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n\n');
        const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_EMAIL;

        if (transporter && adminEmail) {
            await transporter.sendMail({
                from: `LifeScope AI <${process.env.SMTP_EMAIL}>`,
                to: adminEmail,
                subject: `[LifeScope Support] Escalation from ${userName || 'User'}`,
                text: `Support escalation from ${userName} (${userEmail})\n\nChat Transcript:\n${chatTranscript}`,
                html: `<h2>Support Escalation</h2>
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
// HEALTH TEST RESULTS ROUTES
// ============================

app.post('/api/health/test-results', ensureAuth, async (req, res) => {
    try {
        const { test_date, test_type, results, ai_interpretation } = req.body;
        const { rows } = await pool.query(
            `INSERT INTO public.health_test_results (user_id, test_date, test_type, results, ai_interpretation)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [req.user.id, test_date, test_type, JSON.stringify(results), ai_interpretation || null]
        );
        res.json({ data: rows[0] });
    } catch (err) {
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


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
