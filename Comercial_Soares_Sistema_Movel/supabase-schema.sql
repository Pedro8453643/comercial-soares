-- Execute este arquivo no SQL Editor do projeto Supabase.
-- A tabela começa vazia e cada usuário só pode acessar seus próprios pedidos.

create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client text not null,
  items jsonb not null default '[]'::jsonb,
  total numeric(12,2) not null default 0,
  status text not null default 'aberto' check (status in ('aberto', 'finalizado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders enable row level security;

drop policy if exists "Users can read their own orders" on public.orders;
create policy "Users can read their own orders"
on public.orders for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create their own orders" on public.orders;
create policy "Users can create their own orders"
on public.orders for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own orders" on public.orders;
create policy "Users can update their own orders"
on public.orders for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own orders" on public.orders;
create policy "Users can delete their own orders"
on public.orders for delete to authenticated
using (auth.uid() = user_id);

create index if not exists orders_user_created_at_idx
on public.orders (user_id, created_at desc);
