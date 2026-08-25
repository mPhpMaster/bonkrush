-- Persist monster HP between sessions

alter table public.player_monsters
  add column if not exists current_hp integer;

update public.player_monsters pm
set current_hp = ms.base_hp
from public.monster_species ms
where pm.species_id = ms.id
  and pm.current_hp is null;

create or replace function public.sync_monster_hp(
  p_monster_id   uuid,
  p_current_hp   integer
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

  update player_monsters pm
  set current_hp = greatest(0, p_current_hp)
  where pm.id = p_monster_id
    and exists (
      select 1 from characters c
      where c.id = pm.character_id and c.user_id = auth.uid()
    );
end;
$$;

-- Extend use_item to persist heal on active monster
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

  if v_effect.effect_type = 'heal' then
    select ms.base_hp into v_max_hp
    from player_monsters pm
    join monster_species ms on ms.id = pm.species_id
    where pm.id = p_monster_id and pm.character_id = p_character_id;

    if found then
      v_max_hp := v_max_hp + ((select level from player_monsters where id = p_monster_id) - 1) * 4;
      select least(v_max_hp, coalesce(current_hp, v_max_hp) + v_effect.effect_val)
      into v_new_hp
      from player_monsters
      where id = p_monster_id;

      update player_monsters
      set current_hp = v_new_hp
      where id = p_monster_id;
    end if;
  end if;

  return json_build_object(
    'effect_type', v_effect.effect_type,
    'effect_val',  v_effect.effect_val,
    'new_hp',      coalesce(v_new_hp, 0)
  );
end;
$$;

grant execute on function public.sync_monster_hp(uuid, integer) to authenticated;
