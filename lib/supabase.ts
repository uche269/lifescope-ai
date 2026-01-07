import { createClient } from '@supabase/supabase-js';

// These should be set in your environment variables (e.g. .env file)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let client;

const isValidUrl = (urlString: string | undefined) => {
    try {
        if (!urlString) return false;
        return new URL(urlString).protocol.startsWith('http');
    } catch (e) {
        return false;
    }
};

// Only initialize the real client if keys are present AND valid
if (isValidUrl(supabaseUrl) && supabaseKey) {
    client = createClient(supabaseUrl!, supabaseKey);
} else {
    console.warn("Supabase URL or Key is missing or invalid. App is running in offline/demo mode to prevent crash.");
    
    // Create a dummy builder that mimics the Supabase query chain (v2)
    // This returns 'this' for all chaining methods (select, insert, etc.)
    // and resolves to a safe default object when awaited.
    const dummyBuilder = {
        select: function() { return this; },
        order: function() { return this; },
        limit: function() { return this; },
        eq: function() { return this; },
        single: function() { return this; },
        maybeSingle: function() { return this; },
        insert: function() { return this; }, // Allows .insert().select() chaining
        update: function() { return this; },
        delete: function() { return this; },
        
        // This makes the object awaitable (Promise-like)
        then: function(resolve: any) {
            // Return an error structure so the UI knows data fetching failed gracefully
            // or empty data for reads to show empty states.
            resolve({ 
                data: [], 
                error: { message: "Supabase disconnected (Offline Mode)" },
                count: 0,
                status: 200,
                statusText: 'OK' 
            });
        }
    };

    client = {
        from: () => dummyBuilder,
        auth: {
            getSession: () => Promise.resolve({ data: { session: null }, error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
            signInWithOAuth: () => Promise.resolve({ error: { message: 'Offline Mode: Cannot sign in.' } }),
            signInWithOtp: () => Promise.resolve({ error: { message: 'Offline Mode: Cannot sign in.' } }),
            signOut: () => Promise.resolve({ error: null }),
        }
    };
}

export const supabase = client as any;