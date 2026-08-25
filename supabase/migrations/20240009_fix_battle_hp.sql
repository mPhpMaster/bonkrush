-- Fix resolve_battle: preserve battle damage; only full-heal on level-up

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
  v_xp_gain integer := 15 + p_wild_level * 10;
  v_coin_gain integer := 5 + p_wild_level * 3;
  v_new_xp integer; v_new_level integer; v_old_level integer;
  v_xp_needed integer;
  v_new_coins integer; v_char_xp integer; v_char_level integer;
  v_dropped text := null;
  v_species_id text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from characters where id = p_character_id and user_id = auth.uid()) then
    raise exception 'Not your character';
  end if;

  update characters set coins = coins + v_coin_gain, xp = xp + v_xp_gain
  where id = p_character_id returning coins, xp, level into v_new_coins, v_char_xp, v_char_level;

  v_xp_needed := 50 * v_char_level;
  while v_char_xp >= v_xp_needed loop
    v_char_xp := v_char_xp - v_xp_needed; v_char_level := v_char_level + 1;
    v_xp_needed := 50 * v_char_level;
  end loop;
  update characters set xp = v_char_xp, level = v_char_level where id = p_character_id;

  if random() < 0.25 then
    v_dropped := 'potion';
    insert into inventory (character_id, item_id, quantity)
    values (p_character_id, 'potion', 1)
    on conflict (character_id, item_id) do update set quantity = inventory.quantity + 1;
  end if;

  select xp, level, species_id into v_new_xp, v_new_level, v_species_id
  from player_monsters where id = p_monster_id and character_id = p_character_id;

  if not found then
    return json_build_object('xp_gain', v_xp_gain, 'coin_gain', v_coin_gain, 'coins', v_new_coins, 'item_drop', v_dropped);
  end if;

  v_old_level := v_new_level;
  v_new_xp := v_new_xp + v_xp_gain; v_xp_needed := 50 * v_new_level;
  while v_new_xp >= v_xp_needed loop
    v_new_xp := v_new_xp - v_xp_needed; v_new_level := v_new_level + 1; v_xp_needed := 50 * v_new_level;
  end loop;

  if v_new_level > v_old_level then
    update player_monsters set xp = v_new_xp, level = v_new_level,
      current_hp = public.calc_monster_max_hp(v_species_id, v_new_level)
    where id = p_monster_id and character_id = p_character_id;
  else
    update player_monsters set xp = v_new_xp, level = v_new_level
    where id = p_monster_id and character_id = p_character_id;
  end if;

  return json_build_object(
    'xp_gain', v_xp_gain, 'coin_gain', v_coin_gain, 'coins', v_new_coins,
    'monster_xp', v_new_xp, 'monster_level', v_new_level,
    'char_xp', v_char_xp, 'char_level', v_char_level, 'item_drop', v_dropped,
    'leveled_up', v_new_level > v_old_level
  );
end;
$$;
