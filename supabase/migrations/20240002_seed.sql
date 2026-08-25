-- ── Monster species seed ────────────────────────────────────
insert into public.monster_species
  (id, name, type, mesh_key, catch_rate, base_hp, base_attack, base_defense, base_speed)
values
  ('emberling',  'Emberling',  'fire',     'skeleton_warrior', 0.65, 55, 25, 12, 20),
  ('aquafin',    'Aquafin',    'water',    'skeleton_archer',  0.60, 60, 18, 20, 16),
  ('leafkin',    'Leafkin',    'grass',    'skeleton_rogue',   0.70, 58, 20, 18, 18),
  ('sparkit',    'Sparkit',    'electric', 'skeleton_mage',    0.55, 50, 28, 10, 24),
  ('mindwisp',   'Mindwisp',   'psychic',  'skeleton_mage',    0.50, 52, 26, 14, 22),
  ('shadeclaw',  'Shadeclaw',  'dark',     'skeleton_rogue',   0.45, 65, 22, 22, 14),
  ('galehart',   'Galehart',   'wind',     'skeleton_archer',  0.60, 54, 21, 16, 26)
on conflict (id) do nothing;

-- ── Items seed ───────────────────────────────────────────────
insert into public.items (id, name, description, effect_type, effect_val)
values
  ('potion',        'Potion',       'Restores 30 HP to active monster.',  'heal', 30),
  ('super_potion',  'Super Potion', 'Restores 70 HP to active monster.',  'heal', 70),
  ('full_restore',  'Full Restore', 'Fully restores HP to active monster.', 'full_heal', 0)
on conflict (id) do nothing;
