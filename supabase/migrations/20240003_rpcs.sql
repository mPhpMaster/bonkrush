-- ============================================================
-- RPCs (security definer in private schema via search_path trick)
-- Clients call via POST /rest/v1/rpc/<fn>
-- ============================================================

-- ── create_character ─────────────────────────────────────────
-- Creates character + gives starter monster + starting coins
create or replace function public.create_character(
  p_name         text,
  p_starter_type text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_char_id    uuid;
  v_monster_id uuid;
  v_species_id text;
  v_char       json;
begin
  -- Validate auth
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- One character per user
  if exists (select 1 from characters where user_id = auth.uid()) then
    raise exception 'Character already exists';
  end if;

  -- Validate type
  if p_starter_type not in ('fire','water','grass','electric','psychic','dark','wind') then
    raise exception 'Invalid starter type';
  end if;

  -- Map type → species
  v_species_id := case p_starter_type
    when 'fire'     then 'emberling'
    when 'water'    then 'aquafin'
    when 'grass'    then 'leafkin'
    when 'electric' then 'sparkit'
    when 'psychic'  then 'mindwisp'
    when 'dark'     then 'shadeclaw'
    when 'wind'     then 'galehart'
  end;

  -- Create character
  insert into characters (user_id, name, starter_type, coins)
  values (auth.uid(), p_name, p_starter_type, 100)
  returning id into v_char_id;

  -- Give starter (level 5, slot 0, active)
  insert into player_monsters (character_id, species_id, level, xp, is_active, slot)
  values (v_char_id, v_species_id, 5, 0, true, 0)
  returning id into v_monster_id;

  -- Give 3 potions
  insert into inventory (character_id, item_id, quantity)
  values (v_char_id, 'potion', 3);

  -- Return character + party for immediate load
  select json_build_object(
    'id',           c.id,
    'name',         c.name,
    'starter_type', c.starter_type,
    'level',        c.level,
    'xp',           c.xp,
    'coins',        c.coins,
    'last_pos_x',   c.last_pos_x,
    'last_pos_y',   c.last_pos_y,
    'last_pos_z',   c.last_pos_z,
    'party', (
      select json_agg(row_to_json(pm))
      from player_monsters pm
      where pm.character_id = c.id and pm.slot >= 0
    )
  )
  into v_char
  from characters c
  where c.id = v_char_id;

  return v_char;
end;
$$;

-- ── catch_wild_monster ────────────────────────────────────────
-- Server-authoritative catch: inserts into player_monsters,
-- returns null if player already owns that species.
create or replace function public.catch_wild_monster(
  p_species_id  text,
  p_wild_level  integer
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_char_id    uuid;
  v_monster_id uuid;
  v_count      integer;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select id into v_char_id from characters where user_id = auth.uid() limit 1;
  if v_char_id is null then raise exception 'No character found'; end if;

  -- Check duplicate
  select count(*) into v_count
  from player_monsters
  where character_id = v_char_id and species_id = p_species_id;

  if v_count > 0 then
    -- Already owned: give coins + xp to active monster instead
    update characters set coins = coins + 10 where id = v_char_id;
    update player_monsters
    set xp = xp + 20
    where character_id = v_char_id and is_active = true;
    return null;
  end if;

  -- Add to collection (slot = -1)
  insert into player_monsters (character_id, species_id, level, xp, is_active, slot)
  values (v_char_id, p_species_id, p_wild_level, 0, false, -1)
  returning id into v_monster_id;

  return json_build_object('monster_id', v_monster_id, 'species_id', p_species_id);
end;
$$;

-- ── resolve_battle ─────────────────────────────────────────
-- Saves XP + coins after a battle win.
create or replace function public.resolve_battle(
  p_character_id uuid,
  p_monster_id   uuid,
  p_xp_gain      integer,
  p_coin_gain    integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_xp    integer;
  v_new_level integer;
  v_xp_needed integer;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  -- Verify ownership
  if not exists (
    select 1 from characters where id = p_character_id and user_id = auth.uid()
  ) then
    raise exception 'Not your character';
  end if;

  -- Add coins
  update characters set coins = coins + p_coin_gain where id = p_character_id;

  -- Level up monster
  select xp, level into v_new_xp, v_new_level
  from player_monsters where id = p_monster_id and character_id = p_character_id;

  if not found then return; end if;

  v_new_xp := v_new_xp + p_xp_gain;
  v_xp_needed := 50 * v_new_level;
  while v_new_xp >= v_xp_needed loop
    v_new_xp    := v_new_xp - v_xp_needed;
    v_new_level := v_new_level + 1;
    v_xp_needed := 50 * v_new_level;
  end loop;

  update player_monsters
  set xp = v_new_xp, level = v_new_level
  where id = p_monster_id and character_id = p_character_id;
end;
$$;

-- ── use_item ─────────────────────────────────────────────────
create or replace function public.use_item(
  p_item_id      text,
  p_character_id uuid,
  p_monster_id   uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qty     integer;
  v_effect  record;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from characters where id = p_character_id and user_id = auth.uid()) then
    raise exception 'Not your character';
  end if;

  select quantity into v_qty
  from inventory
  where character_id = p_character_id and item_id = p_item_id;

  if v_qty is null or v_qty <= 0 then
    raise exception 'Item not available';
  end if;

  -- Reduce quantity
  update inventory
  set quantity = quantity - 1
  where character_id = p_character_id and item_id = p_item_id;

  select effect_type, effect_val into v_effect from items where id = p_item_id;

  return json_build_object(
    'effect_type', v_effect.effect_type,
    'effect_val',  v_effect.effect_val
  );
end;
$$;

-- ── save_position ────────────────────────────────────────────
create or replace function public.save_position(
  p_character_id uuid,
  p_x numeric,
  p_y numeric,
  p_z numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update characters
  set last_pos_x = p_x, last_pos_y = p_y, last_pos_z = p_z
  where id = p_character_id and user_id = auth.uid();
end;
$$;

-- Grant RPC access to authenticated users
grant execute on function public.create_character(text, text) to authenticated;
grant execute on function public.catch_wild_monster(text, integer) to authenticated;
grant execute on function public.resolve_battle(uuid, uuid, integer, integer) to authenticated;
grant execute on function public.use_item(text, uuid, uuid) to authenticated;
grant execute on function public.save_position(uuid, numeric, numeric, numeric) to authenticated;
