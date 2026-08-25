-- ============================================================
-- 3D Monster RPG – initial schema
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Monster species (reference table, public read) ───────────
create table public.monster_species (
  id           text primary key,                 -- e.g. "emberling"
  name         text not null,
  type         text not null,
  mesh_key     text not null,
  catch_rate   numeric(4,3) not null default 0.5,
  base_hp      integer not null default 55,
  base_attack  integer not null default 20,
  base_defense integer not null default 15,
  base_speed   integer not null default 18
);

alter table public.monster_species enable row level security;
create policy "public read species"
  on public.monster_species for select
  using (true);

-- ── Items catalog ──────────────────────────────────────────
create table public.items (
  id          text primary key,
  name        text not null,
  description text not null default '',
  effect_type text not null default 'heal',
  effect_val  integer not null default 30
);

alter table public.items enable row level security;
create policy "public read items"
  on public.items for select
  using (true);

-- ── Characters ──────────────────────────────────────────────
create table public.characters (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  starter_type text not null,
  level        integer not null default 1,
  xp           integer not null default 0,
  coins        integer not null default 100,
  last_pos_x   numeric not null default 0,
  last_pos_y   numeric not null default 0,
  last_pos_z   numeric not null default 5,
  created_at   timestamptz not null default now()
);

alter table public.characters enable row level security;
create policy "owner select character"
  on public.characters for select
  using (auth.uid() = user_id);
create policy "owner update character"
  on public.characters for update
  using (auth.uid() = user_id);

-- ── Player monsters ─────────────────────────────────────────
create table public.player_monsters (
  id           uuid primary key default uuid_generate_v4(),
  character_id uuid not null references public.characters(id) on delete cascade,
  species_id   text not null references public.monster_species(id),
  level        integer not null default 1,
  xp           integer not null default 0,
  is_active    boolean not null default false,
  slot         integer not null default -1,  -- -1 = collection, 0-3 = party
  created_at   timestamptz not null default now()
);

alter table public.player_monsters enable row level security;
create policy "owner select monsters"
  on public.player_monsters for select
  using (
    exists (
      select 1 from public.characters c
      where c.id = character_id and c.user_id = auth.uid()
    )
  );
-- No direct insert/update from client: use RPCs only.

-- ── Inventory ───────────────────────────────────────────────
create table public.inventory (
  id           uuid primary key default uuid_generate_v4(),
  character_id uuid not null references public.characters(id) on delete cascade,
  item_id      text not null references public.items(id),
  quantity     integer not null default 0,
  unique (character_id, item_id)
);

alter table public.inventory enable row level security;
create policy "owner select inventory"
  on public.inventory for select
  using (
    exists (
      select 1 from public.characters c
      where c.id = character_id and c.user_id = auth.uid()
    )
  );
