-- Swap active party monster + sync faint coin penalty

create or replace function public.set_active_monster(
  p_character_id uuid,
  p_slot         integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from characters where id = p_character_id and user_id = auth.uid()
  ) then
    raise exception 'Not your character';
  end if;

  if not exists (
    select 1 from player_monsters
    where character_id = p_character_id and slot = p_slot and slot >= 0
  ) then
    raise exception 'Invalid party slot';
  end if;

  update player_monsters
  set is_active = false
  where character_id = p_character_id and slot >= 0;

  update player_monsters
  set is_active = true
  where character_id = p_character_id and slot = p_slot;
end;
$$;

create or replace function public.apply_faint_penalty(
  p_character_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coins integer;
  v_penalty integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select coins into v_coins
  from characters
  where id = p_character_id and user_id = auth.uid();

  if not found then
    raise exception 'Not your character';
  end if;

  v_penalty := greatest(1, (v_coins * 5) / 100);

  update characters
  set coins = greatest(0, coins - v_penalty)
  where id = p_character_id
  returning coins into v_coins;

  return v_coins;
end;
$$;

grant execute on function public.set_active_monster(uuid, integer) to authenticated;
grant execute on function public.apply_faint_penalty(uuid) to authenticated;
