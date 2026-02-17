
// Replacement for Supabase Client
// This talks to our own /api endpoints

const API_URL = import.meta.env.VITE_API_URL || ''; // Relative path in production

export const apiClient = {
    auth: {
        signInWithOAuth: ({ provider }: { provider: string }) => {
            if (provider === 'google') {
                window.location.href = `${API_URL}/api/auth/google`;
                return Promise.resolve({ data: {}, error: null });
            }
            return Promise.resolve({ data: {}, error: { message: "Provider not supported" } });
        },
        signInWithOtp: async ({ email }: { email: string }) => {
            console.warn("Magic Link not implemented on VPS backend");
            return Promise.resolve({ data: {}, error: { message: "Magic Link login is not configured on this server. Please use Google Login." } });
        },
        signOut: async () => {
            await fetch(`${API_URL}/api/auth/logout`, { method: 'POST' });
            window.location.reload();
        },
        getSession: async () => {
            const res = await fetch(`${API_URL}/api/auth/me`);
            if (res.ok) {
                const data = await res.json();
                return { data: { session: data.user ? { user: data.user } : null }, error: null };
            }
            return { data: { session: null }, error: null };
        },
        onAuthStateChange: (callback: any) => {
            // Poll for session or just check once?
            // For now, simpler: we just check on mount. 
            // This mock subscription returns a dummy unsubscribe
            return { data: { subscription: { unsubscribe: () => { } } } };
        }
    },
    from: (table: string) => {
        return {
            select: async () => {
                const res = await fetch(`${API_URL}/api/data/${table}`);
                const json = await res.json();
                return json;
            },
            insert: async (data: any) => {
                const res = await fetch(`${API_URL}/api/data/${table}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const json = await res.json();
                // Supabase returns { data: [row], error }
                // Our API returns { data: row, error }
                return { data: json.data ? [json.data] : null, error: json.error };
            },
            // Add update/delete placeholders as needed
            update: async () => ({ error: "Not implemented yet" }),
            delete: async () => ({ error: "Not implemented yet" })
        };
    }
};

// Export as 'supabase' so we don't have to refactor the whole app imports!
export const supabase = apiClient;
