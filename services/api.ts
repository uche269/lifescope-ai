import { Goal, Activity } from '../types';

const API_BASE = '/api/data';

/**
 * Generic API Service to replace Supabase Client
 */
export const api = {
    get: async (table: string, params: Record<string, any> = {}) => {
        const searchParams = new URLSearchParams();
        if (params.select) searchParams.append('select', params.select);
        if (params.order) searchParams.append('order', params.order);
        if (params.orderBy) searchParams.append('order', `${params.orderBy}.${params.ascending === 'true' ? 'asc' : 'desc'}`);
        if (params.limit) searchParams.append('limit', params.limit);

        const res = await fetch(`${API_BASE}/${table}?${searchParams.toString()}`, { credentials: 'include' });
        if (!res.ok) throw new Error(`Failed to fetch ${table}`);
        const json = await res.json();
        // Backend returns { data: [...], error: null } shape
        return json.data !== undefined ? json.data : json;
    },

    post: async (table: string, data: any, options?: RequestInit) => {
        const res = await fetch(`${API_BASE}/${table}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...options?.headers },
            credentials: 'include',
            ...options,
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`Failed to insert into ${table}`);
        const json = await res.json();
        return json.data !== undefined ? json.data : json;
    },

    put: async (table: string, id: string, data: any) => {
        const res = await fetch(`${API_BASE}/${table}?id=${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`Failed to update ${table}`);
        const json = await res.json();
        return json.data !== undefined ? json.data : json;
    },

    delete: async (table: string, id: string) => {
        const res = await fetch(`${API_BASE}/${table}?id=${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!res.ok) throw new Error(`Failed to delete from ${table}`);
        return res.json();
    }
};

// Helper for Goals specifically since it has custom logic in backend
export const fetchGoals = async () => {
    // api.get already unwraps { data, error } from the backend response
    const result = await api.get('goals', { select: '*, activities (*)', order: 'created_at.desc' });
    // result is now the array directly (or an object if something went wrong)
    return Array.isArray(result) ? result : (result?.data ?? []);
};
