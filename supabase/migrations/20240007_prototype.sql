-- Full prototype: party slots, server-authoritative combat/catch, shared stats

drop function if exists public.resolve_battle(uuid, uuid, integer, integer);

-- Shared stat formula (matches client SpeciesDB.calc_stats)
create or replace function public.calc_monster_stat(p_base integer, p_level integer)
returns integer
language sql
immutable
as $$
  select floor(p_base * (1.0 + 0.08 * greatest(0, p_level - 1)))::integer;
$$;

create or replace function public.calc_monster_max_hp(p_species_id text, p_level integer)
returns integer
language sql
stable
as $$
  select public.calc_monster_stat(ms.base_hp, p_level)
  from public.monster_species ms
  where ms.id = p_species_id;
$$;

-- Move monster between party (slot 0-3) and collection (slot -1)
create or replace function public.set_party_slot(
  p_character_id uuid,
  p_monster_id   uuid,
  p_slot         integer
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_slot integer;
  v_other_id     uuid;
  v_party_count  integer;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from characters where id = p_character_id and user_id = auth.uid()
  ) then
    raise exception 'Not your character';
  end if;

  select slot into v_current_slot
  from player_monsters
  where id = p_monster_id and character_id = p_character_id;

  if not found then raise exception 'Monster not found'; end if;

  if p_slot = -1 then
    update player_monsters
    set slot = -1, is_active = false
    where id = p_monster_id and character_id = p_character_id;

    if not exists (
      select 1 from player_monsters
      where character_id = p_character_id and is_active = true and slot >= 0
    ) then
      update player_monsters
      set is_active = true
      where id = (
        select id from player_monsters
        where character_id = p_character_id and slot >= 0
        order by slot asc limit 1
      );
    end if;

    return json_build_object('slot', -1);
  end if;

  if p_slot < 0 or p_slot > 3 then
    raise exception 'Party slot must be 0-3 or -1 for collection';
  end if;

  select count(*) into v_party_count
  from player_monsters
  where character_id = p_character_id and slot >= 0 and id <> p_monster_id;

  if v_current_slot < 0 and v_party_count >= 4 then
    raise exception 'Party is full (max 4)';
  end if;

  select id into v_other_id
  from player_monsters
  where character_id = p_character_id and slot = p_slot and id <> p_monster_id;

  if v_other_id is not null then
    update player_monsters
    set slot = v_current_slot
    where id = v_other_id;
  end if;

  update player_monsters
  set slot = p_slot
  where id = p_monster_id and character_id = p_character_id;

  return json_build_object('slot', p_slot);
end;
$$;

-- Server computes battle rewards from wild level
create or replace function public.resolve_battle(
  p_character_id uuid,
  p_monster_id   uuid,
  p_wild_level   integer
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_xp_gain    integer := 15 + p_wild_level * 10;
  v_coin_gain  integer := 5 + p_wild_level * 3;
  v_new_xp     integer;
  v_new_level  integer;
  v_xp_needed  integer;
  v_new_coins  integer;
  v_char_xp    integer;
  v_char_level integer;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from characters where id = p_character_id and user_id = auth.uid()
  ) then
    raise exception 'Not your character';
  end if;

  update characters
  set coins = coins + v_coin_gain,
      xp = xp + v_xp_gain
  where id = p_character_id
  returning coins, xp, level into v_new_coins, v_char_xp, v_char_level;

  v_xp_needed := 50 * v_char_level;
  while v_char_xp >= v_xp_needed loop
    v_char_xp := v_char_xp - v_xp_needed;
    v_char_level := v_char_level + 1;
    v_xp_needed := 50 * v_char_level;
  end loop;

  update characters set xp = v_char_xp, level = v_char_level where id = p_character_id;

  select xp, level into v_new_xp, v_new_level
  from player_monsters where id = p_monster_id and character_id = p_character_id;

  if not found then
    return json_build_object('xp_gain', v_xp_gain, 'coin_gain', v_coin_gain, 'coins', v_new_coins);
  end if;

  v_new_xp := v_new_xp + v_xp_gain;
  v_xp_needed := 50 * v_new_level;
  while v_new_xp >= v_xp_needed loop
    v_new_xp := v_new_xp - v_xp_needed;
    v_new_level := v_new_level + 1;
    v_xp_needed := 50 * v_new_level;
  end loop;

  update player_monsters
  set xp = v_new_xp, level = v_new_level,
      current_hp = public.calc_monster_max_hp(species_id, v_new_level)
  where id = p_monster_id and character_id = p_character_id;

  return json_build_object(
    'xp_gain', v_xp_gain,
    'coin_gain', v_coin_gain,
    'coins', v_new_coins,
    'monster_xp', v_new_xp,
    'monster_level', v_new_level,
    'char_xp', v_char_xp,
    'char_level', v_char_level
  );
end;
$$;

-- Server-side catch roll + insert
create or replace function public.attempt_catch_wild(
  p_species_id text,
  p_wild_level integer
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_char_id    uuid;
  v_catch_rate numeric;
  v_chance     numeric;
  v_monster_id uuid;
  v_count      integer;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select id into v_char_id from characters where user_id = auth.uid() limit 1;
  if v_char_id is null then raise exception 'No character found'; end if;

  select catch_rate into v_catch_rate from monster_species where id = p_species_id;
  if v_catch_rate is null then raise exception 'Unknown species'; end if;

  v_chance := greatest(0.05, least(0.95, v_catch_rate - p_wild_level * 0.12));
  if random() >= v_chance then
    return json_build_object('result', 'escaped');
  end if;

  select count(*) into v_count
  from player_monsters
  where character_id = v_char_id and species_id = p_species_id;

  if v_count > 0 then
    update characters set coins = coins + 10 where id = v_char_id returning coins into v_count;
    update player_monsters
    set xp = xp + 20
    where character_id = v_char_id and is_active = true;
    return json_build_object('result', 'duplicate', 'coins', v_count);
  end if;

  insert into player_monsters (character_id, species_id, level, xp, is_active, slot, current_hp)
  values (
    v_char_id, p_species_id, p_wild_level, 0, false, -1,
    public.calc_monster_max_hp(p_species_id, p_wild_level)
  )
  returning id into v_monster_id;

  return json_build_object(
    'result', 'caught',
    'monster_id', v_monster_id,
    'species_id', p_species_id
  );
end;
$$;

-- Full item support with consistent HP formula
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
  v_max_hp  integer;
  v_new_hp  integer;
  v_cur_hp  integer;
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

  update inventory
  set quantity = quantity - 1
  where character_id = p_character_id and item_id = p_item_id;

  select effect_type, effect_val into v_effect from items where id = p_item_id;

  select public.calc_monster_max_hp(pm.species_id, pm.level), coalesce(pm.current_hp, public.calc_monster_max_hp(pm.species_id, pm.level))
  into v_max_hp, v_cur_hp
  from player_monsters pm
  where pm.id = p_monster_id and pm.character_id = p_character_id;

  if not found then
    return json_build_object('effect_type', v_effect.effect_type, 'effect_val', v_effect.effect_val, 'new_hp', 0);
  end if;

  if v_effect.effect_type = 'heal' then
    v_new_hp := least(v_max_hp, v_cur_hp + v_effect.effect_val);
  elsif v_effect.effect_type = 'full_heal' then
    v_new_hp := v_max_hp;
  else
    v_new_hp := v_cur_hp;
  end if;

  update player_monsters set current_hp = v_new_hp where id = p_monster_id;

  return json_build_object(
    'effect_type', v_effect.effect_type,
    'effect_val',  v_effect.effect_val,
    'new_hp',      v_new_hp
  );
end;
$$;

grant execute on function public.set_party_slot(uuid, uuid, integer) to authenticated;
grant execute on function public.resolve_battle(uuid, uuid, integer) to authenticated;
grant execute on function public.attempt_catch_wild(text, integer) to authenticated;
grant execute on function public.calc_monster_stat(integer, integer) to authenticated;
grant execute on function public.calc_monster_max_hp(text, integer) to authenticated;
