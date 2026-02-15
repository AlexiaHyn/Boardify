create extension if not exists pgcrypto;

create table if not exists public.game_showcases (
    id uuid primary key default gen_random_uuid(),
    game_code text not null unique,
    game_id uuid not null,
    host_person text not null,
    game_snapshot jsonb not null,
    status text not null check (status in ('completed', 'abandoned')),
    created_at timestamptz not null default now(),
    completed_at timestamptz
);

create index if not exists idx_game_showcases_created_at
on public.game_showcases (created_at desc);
