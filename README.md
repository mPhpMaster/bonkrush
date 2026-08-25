# 3D Monster RPG

A single-player 3D monster RPG built with **Godot 4**, **Supabase**, and **Vercel**.

**Live companion site:** https://web-pi-lilac-20.vercel.app

## Structure

```
game/      Godot 4.4 project (terrain, player, monsters, UI)
web/       Next.js 16 companion site (Vercel)
supabase/  Database migrations and seed SQL
```

## Store Assets Required (Godot Asset Library)

Open the Godot editor in `game/`, click **AssetLib** and install:

| Asset | Purpose |
|---|---|
| [Terrain3D](https://godotengine.org/asset-library/asset/3892) | GPU-driven sculpted terrain |
| [KayKit Character Pack: Adventurers](https://godotengine.org/asset-library/asset/2129) | Player model (4 heroes, 75 animations) |
| [KayKit Character Pack: Skeletons](https://godotengine.org/asset-library/asset/2566) | Monster models (4 skeletons, 90+ animations) |
| KayKit Halloween Bits | Trees, rocks, world dressing |

KayKit models are pre-copied under `game/assets/models/kaykit/`. **Terrain3D** is installed via script (not committed):

```powershell
pwsh scripts/install_godot_addons.ps1
# or: bash scripts/install_godot_addons.sh
```

After installing, restart the editor and enable **Terrain3D** in Project Settings → Plugins. The island heightmap is generated at runtime; you can also sculpt further in-editor under `$World/Terrain`.

## Supabase

- **Project:** `mto-game` at `https://nkmkljpbmuypasjdvxtv.supabase.co`
- Schema, RLS, RPCs, and 7 species already applied via migrations in `supabase/migrations/`.
- Game config is in `game/autoloads/config.gd` (URL + anon key already set).

## Game Setup

1. Open `game/` in Godot 4.4+ (first launch imports KayKit FBX assets).
2. Run `pwsh scripts/install_godot_addons.ps1` to install Terrain3D (or use Asset Library).
3. Press **F5** to run, or use demo mode without Supabase:

```bash
godot --path game --demo
```

Demo mode skips login, gives a fire starter + 3 potions, and **autosaves** progress to `user://demo_save.json`.

## Play with friends (prototype)

This version is an **open playtest**, not live co-op in one session.

1. Each friend creates an account at https://web-pi-lilac-20.vercel.app/login  
2. Install [Godot 4.7](https://godotengine.org/download), then:

```powershell
pwsh scripts/run_game.ps1
```

3. Log in inside the game (same email), create a trainer, fight at the shrine.  
4. Scores show on https://web-pi-lilac-20.vercel.app/leaderboard  

Press **H** in-game for the tutorial. Demo mode (`-Demo`) is offline only and does **not** post to the board.

## Full Prototype Loop

| Step | Godot | Web |
|------|-------|-----|
| Account | Email login/signup | https://web-pi-lilac-20.vercel.app/login |
| Character | Name + starter type (Godot) | `/character` (view only) |
| Explore | Island terrain, wild spawns | — |
| Battle | Real-time auto-fight, abilities 1/2/3 | — |
| Catch | Server roll → collection | `/collection` → Add to Party |
| Party | Tab swap, up to 4 slots | `/party` → Set Active |
| Items | Potions (I key) | `/inventory` → Use |
| Shop | Shrine spawn [E] | `/shop` → Buy |
| Drops | 25% potion on win | Same inventory |
| Audio | Procedural SFX | — |
| Cloud save | Supabase RPCs + HP sync | Same account |

## Web Companion Setup

```bash
cd web
npm install
npm run dev
```

Or visit the live deployment: https://web-pi-lilac-20.vercel.app

## Gameplay

- **Email/password** login in the Godot client.
- First launch: name your character, pick a starter type.
- Explore the island. Wild monsters wander at level 1–3.
- **Walk near a wild monster** → it aggroes and your companion auto-attacks.
- **Win** → coins + XP + chance to catch (synced to Supabase when logged in).
- **Lose** → respawn at shrine, lose 5% coins (synced via `apply_faint_penalty` RPC).
- Press **E** shop (at shrine) · **I** inventory · **C** collection · **P** party / swap active monster · **Esc** close menu or lock cursor.

## Type Chart

| Type | Strong vs | Weak vs |
|---|---|---|
| 🔥 Fire | Grass, Wind | Water, Dark |
| 💧 Water | Fire, Dark | Grass, Electric |
| 🌿 Grass | Water, Electric | Fire, Wind |
| ⚡ Electric | Water, Wind | Grass, Psychic |
| 🔮 Psychic | Electric, Dark | Wind, Dark |
| 🌑 Dark | Psychic, Grass | Water, Fire |
| 🌬 Wind | Grass, Psychic | Electric, Fire |

Strong = 1.5× · Weak = 0.7× · Neutral = 1.0×

## Monster Species

| Name | Type | Catch Rate |
|---|---|---|
| Emberling | Fire | 65% |
| Aquafin | Water | 60% |
| Leafkin | Grass | 70% |
| Sparkit | Electric | 55% |
| Mindwisp | Psychic | 50% |
| Shadeclaw | Dark | 45% |
| Galehart | Wind | 60% |

Catch rate decreases with wild level (−12% per level).
