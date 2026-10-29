import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);
export const supabase = isSupabaseConfigured
  ? createClient(url!, anonKey!)
  : null;

export type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
};

export type OrderRecord = {
  id: string;
  user_id: string;
  client: string;
  items: OrderItem[];
  total: number;
  status: 'aberto' | 'finalizado';
  created_at: string;
  updated_at: string;
};