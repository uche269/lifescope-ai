
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
            await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
            window.location.reload();
        },
        getSession: async () => {
            const res = await fetch(`${API_URL}/api/auth/me`, { credentials: 'include' });
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
            select: (columns?: string) => {
                // Build a chainable query object
                const params = new URLSearchParams();
                if (columns) params.set('select', columns);

                const queryBuilder: any = {
                    order: (column: string, opts?: { ascending?: boolean }) => {
                        params.set('order', `${column}.${opts?.ascending === false ? 'desc' : 'asc'}`);
                        return queryBuilder;
                    },
                    eq: (column: string, value: string) => {
                        params.set(`filter_${column}`, value);
                        return queryBuilder;
                    },
                    single: () => {
                        params.set('single', 'true');
                        return queryBuilder;
                    },
                    then: (resolve: any, reject?: any) => {
                        const qs = params.toString();
                        const url = `${API_URL}/api/data/${table}${qs ? '?' + qs : ''}`;
                        return fetch(url, { credentials: 'include' })
                            .then(r => r.json())
                            .then(resolve, reject);
                    }
                };
                return queryBuilder;
            },
            insert: (data: any) => {
                const insertBuilder: any = {
                    _data: null as any,
                    _single: false,
                    select: () => {
                        return insertBuilder;
                    },
                    single: () => {
                        insertBuilder._single = true;
                        return insertBuilder;
                    },
                    then: (resolve: any, reject?: any) => {
                        return fetch(`${API_URL}/api/data/${table}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify(data)
                        })
                            .then(r => r.json())
                            .then(json => {
                                if (insertBuilder._single) {
                                    return { data: json.data, error: json.error };
                                }
                                return { data: json.data ? [json.data] : null, error: json.error };
                            })
                            .then(resolve, reject);
                    }
                };
                return insertBuilder;
            },
            update: (data: any) => {
                const updateBuilder: any = {
                    _eqs: {} as Record<string, string>,
                    eq: (column: string, value: string) => {
                        updateBuilder._eqs[column] = value;
                        return updateBuilder;
                    },
                    select: () => updateBuilder,
                    single: () => updateBuilder,
                    then: (resolve: any, reject?: any) => {
                        const params = new URLSearchParams(updateBuilder._eqs);
                        return fetch(`${API_URL}/api/data/${table}?${params}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify(data)
                        })
                            .then(r => r.json())
                            .then(resolve, reject);
                    }
                };
                return updateBuilder;
            },
            delete: () => {
                const deleteBuilder: any = {
                    _eqs: {} as Record<string, string>,
                    eq: (column: string, value: string) => {
                        deleteBuilder._eqs[column] = value;
                        return deleteBuilder;
                    },
                    then: (resolve: any, reject?: any) => {
                        const params = new URLSearchParams(deleteBuilder._eqs);
                        return fetch(`${API_URL}/api/data/${table}?${params}`, {
                            method: 'DELETE',
                            credentials: 'include'
                        })
                            .then(r => r.json())
                            .then(resolve, reject);
                    }
                };
                return deleteBuilder;
            }
        };
    }
};

// Export as 'supabase' so we don't have to refactor the whole app imports!
export const supabase = apiClient;
