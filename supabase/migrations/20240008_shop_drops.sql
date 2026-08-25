-- Shop, battle item drops, starter HP fix

alter table public.items add column if not exists price integer not null default 0;
update public.items set price = 50 where id = 'potion';
update public.items set price = 120 where id = 'super_potion';
update public.items set price = 200 where id = 'full_restore';

create or replace function public.buy_item(
  p_item_id      text,
  p_character_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_price integer;
  v_coins integer;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from characters where id = p_character_id and user_id = auth.uid()) then
    raise exception 'Not your character';
  end if;

  select price into v_price from items where id = p_item_id;
  if v_price is null or v_price <= 0 then raise exception 'Item not for sale'; end if;

  select coins into v_coins from characters where id = p_character_id for update;
  if v_coins < v_price then raise exception 'Not enough coins'; end if;

  update characters set coins = coins - v_price where id = p_character_id returning coins into v_coins;

  insert into inventory (character_id, item_id, quantity)
  values (p_character_id, p_item_id, 1)
  on conflict (character_id, item_id)
  do update set quantity = inventory.quantity + 1;

  return json_build_object('item_id', p_item_id, 'coins', v_coins);
end;
$$;

-- Patch create_character starter to include current_hp
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
  v_max_hp     integer;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from characters where user_id = auth.uid()) then
    raise exception 'Character already exists';
  end if;
  if p_starter_type not in ('fire','water','grass','electric','psychic','dark','wind') then
    raise exception 'Invalid starter type';
  end if;

  v_species_id := case p_starter_type
    when 'fire' then 'emberling' when 'water' then 'aquafin' when 'grass' then 'leafkin'
    when 'electric' then 'sparkit' when 'psychic' then 'mindwisp' when 'dark' then 'shadeclaw'
    when 'wind' then 'galehart'
  end;

  insert into characters (user_id, name, starter_type, coins)
  values (auth.uid(), p_name, p_starter_type, 100)
  returning id into v_char_id;

  v_max_hp := public.calc_monster_max_hp(v_species_id, 5);
  insert into player_monsters (character_id, species_id, level, xp, is_active, slot, current_hp)
  values (v_char_id, v_species_id, 5, 0, true, 0, v_max_hp)
  returning id into v_monster_id;

  insert into inventory (character_id, item_id, quantity)
  values (v_char_id, 'potion', 3);

  select json_build_object(
    'id', c.id, 'name', c.name, 'starter_type', c.starter_type,
    'level', c.level, 'xp', c.xp, 'coins', c.coins,
    'last_pos_x', c.last_pos_x, 'last_pos_y', c.last_pos_y, 'last_pos_z', c.last_pos_z,
    'party', (
      select json_agg(row_to_json(pm))
      from player_monsters pm where pm.character_id = c.id and pm.slot >= 0
    )
  ) into v_char from characters c where c.id = v_char_id;

  return v_char;
end;
$$;

-- Add item drop chance to resolve_battle (25% potion)
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
  v_new_xp integer; v_new_level integer; v_xp_needed integer;
  v_new_coins integer; v_char_xp integer; v_char_level integer;
  v_dropped text := null;
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

  select xp, level into v_new_xp, v_new_level
  from player_monsters where id = p_monster_id and character_id = p_character_id;

  if not found then
    return json_build_object('xp_gain', v_xp_gain, 'coin_gain', v_coin_gain, 'coins', v_new_coins, 'item_drop', v_dropped);
  end if;

  v_new_xp := v_new_xp + v_xp_gain; v_xp_needed := 50 * v_new_level;
  while v_new_xp >= v_xp_needed loop
    v_new_xp := v_new_xp - v_xp_needed; v_new_level := v_new_level + 1; v_xp_needed := 50 * v_new_level;
  end loop;

  update player_monsters set xp = v_new_xp, level = v_new_level,
    current_hp = public.calc_monster_max_hp(species_id, v_new_level)
  where id = p_monster_id and character_id = p_character_id;

  return json_build_object(
    'xp_gain', v_xp_gain, 'coin_gain', v_coin_gain, 'coins', v_new_coins,
    'monster_xp', v_new_xp, 'monster_level', v_new_level,
    'char_xp', v_char_xp, 'char_level', v_char_level, 'item_drop', v_dropped
  );
end;
$$;

grant execute on function public.buy_item(text, uuid) to authenticated;
