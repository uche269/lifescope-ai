import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import pg from 'pg';
import connectPgSimple from 'connect-pg-simple';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

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
        await pool.query(`
            CREATE TABLE IF NOT EXISTS public.users (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                full_name TEXT,
                avatar_url TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("✅ Database schema ensured");
    } catch (err) {
        console.error("❌ Database schema init failed:", err);
    }
};
initDb();

// Session Store
const PgSession = connectPgSimple(session);

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
        secure: process.env.NODE_ENV === 'production' // true in production (https)
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

            // Check if user exists in our custom 'users' table (mapped from Supabase schema if proceeding with that, or a new schema)
            // Since we are migrating from Supabase, let's look at `auth.users` mock or creating a `public.users` table.
            // Simplified: Store in `public.users`

            // Security: Check Whitelist
            const allowedUsers = process.env.ALLOWED_USERS ? process.env.ALLOWED_USERS.split(',').map(e => e.trim()) : [];
            if (allowedUsers.length > 0 && !allowedUsers.includes(email)) {
                console.warn(`⛔ Login attempt blocked for: ${email}`);
                return done(null, false, { message: 'Unauthorized email' });
            }

            // 1. Check if user exists
            let { rows } = await pool.query('SELECT * FROM public.users WHERE email = $1', [email]);

            if (rows.length === 0) {
                // 2. Create user if not exists
                const result = await pool.query(
                    'INSERT INTO public.users (email, full_name, avatar_url) VALUES ($1, $2, $3) RETURNING *',
                    [email, profile.displayName, profile.photos[0]?.value]
                );
                rows = result.rows;
            }

            return done(null, rows[0]);
        } catch (err) {
            console.error("❌ Google Auth Error:", err);
            return done(err, null);
        }
    }
));

// --- API Routes ---

// Auth Routes
app.get('/api/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/api/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        res.redirect('/');
    }
);

app.get('/api/auth/me', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ user: req.user });
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
    const { select, order, user_id_filter } = req.query; // Simple query params

    // Security: Whitelist allowed tables
    const allowedTables = ['goals', 'activities', 'categories'];
    if (!allowedTables.includes(table)) {
        return res.status(403).json({ error: "Access denied to table" });
    }

    try {
        // Enforce Row Level Security (Manual) -> WHERE user_id = req.user.id
        // Assuming all tables have user_id
        let query = `SELECT * FROM public."${table}" WHERE user_id = $1`;
        const values = [req.user.id];

        // Simple Ordering
        if (order) {
            // e.g. "created_at.desc" -> "ORDER BY created_at DESC"
            // Very basic validation needed here to prevent injection
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

    const allowedTables = ['goals', 'activities'];
    if (!allowedTables.includes(table)) {
        return res.status(403).json({ error: "Access denied" });
    }

    try {
        // Force user_id
        payload.user_id = req.user.id;

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


// Serve Static Frontend directly (Production Mode)
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../dist')));

    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../dist/index.html'));
    });
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
