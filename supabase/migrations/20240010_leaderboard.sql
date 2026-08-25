-- Public trainer board so friends can compete without exposing private character rows.

create table if not exists public.trainer_board (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  level integer not null default 1,
  coins integer not null default 0,
  wild_kills integer not null default 0,
  catches integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.trainer_board enable row level security;

drop policy if exists "public read trainer board" on public.trainer_board;
create policy "public read trainer board"
  on public.trainer_board for select
  using (true);

create or replace function public.publish_score(
  p_name text,
  p_level integer,
  p_coins integer,
  p_kills integer,
  p_catches integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.trainer_board (
    user_id, display_name, level, coins, wild_kills, catches, updated_at
  ) values (
    auth.uid(),
    left(coalesce(p_name, 'Trainer'), 24),
    greatest(1, coalesce(p_level, 1)),
    greatest(0, coalesce(p_coins, 0)),
    greatest(0, coalesce(p_kills, 0)),
    greatest(0, coalesce(p_catches, 0)),
    now()
  )
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    level = excluded.level,
    coins = excluded.coins,
    wild_kills = greatest(public.trainer_board.wild_kills, excluded.wild_kills),
    catches = greatest(public.trainer_board.catches, excluded.catches),
    updated_at = now();
end;
$$;

grant execute on function public.publish_score(text, integer, integer, integer, integer) to authenticated;
grant select on public.trainer_board to anon, authenticated;
