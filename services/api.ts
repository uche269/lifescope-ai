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
        if (params.limit) searchParams.append('limit', params.limit);

        const res = await fetch(`${API_BASE}/${table}?${searchParams.toString()}`);
        if (!res.ok) throw new Error(`Failed to fetch ${table}`);
        return res.json();
    },

    post: async (table: string, data: any) => {
        const res = await fetch(`${API_BASE}/${table}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`Failed to insert into ${table}`);
        return res.json();
    },

    put: async (table: string, id: string, data: any) => {
        const res = await fetch(`${API_BASE}/${table}?id=${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`Failed to update ${table}`);
        return res.json();
    },

    delete: async (table: string, id: string) => {
        const res = await fetch(`${API_BASE}/${table}?id=${id}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error(`Failed to delete from ${table}`);
        return res.json();
    }
};

// Helper for Goals specifically since it has custom logic in backend
export const fetchGoals = async () => {
    const { data, error } = await api.get('goals', { select: '*, activities (*)', order: 'created_at.desc' });
    if (error) throw new Error(error.message);
    return data as Goal[];
};
