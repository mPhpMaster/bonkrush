# BONKRUSH

A 3D horde-survivor in the spirit of [Megabonk](https://store.steampowered.com/app/3405340/Megabonk/): you move, weapons bonk on their own, gems level you up, and the build goes ridiculous.

Original game — not affiliated with Megabonk.

## Run

```powershell
pwsh scripts/run_bonkrush.ps1
```

Or from this folder:

```powershell
pwsh .\run.ps1
```

Opens http://localhost:4173

## Controls

- **WASD** move (camera-relative)
- **Mouse** look (click the game to lock the pointer)
- **Shift** dash (also once in the air)
- **Space** jump; tap for a short hop, hold for full height, press again in the air to double jump
- **Left-click** / **F** hold to charge a smash (release near full for Precision)
- **Tab** hold to show the full island map
- **E** activate a shrine or the Moai shop
- **1 / 2 / 3** pick a level-up card
- **R** reroll cards (costs gold)
- **X** skip the level-up and heal
- **Esc** pause (shows your current build)

## Loop

Survive 8 minutes. Kill packs, vacuum XP, pick 1 of 3 random upgrades. Shrines around the map, a Moai shop at 1:30, chests, elites, and bosses at 1:00 / 3:00 / 6:00.

Weapons evolve at level 8. Unlock **Grom** (3 min), **Vex** (400 kills), **Nyla** (3 chests), **Kett** (40 gold). Progress is stored in `localStorage`.
