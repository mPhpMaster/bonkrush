#!/usr/bin/env bash
# Installs Godot addons required by 3D Monster RPG (Terrain3D).
# Run from repo root: bash scripts/install_godot_addons.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADDONS="$ROOT/game/addons"
TERRAIN="$ADDONS/terrain_3d"
REPO="https://github.com/TokisanGames/Terrain3D.git"
TAG="v1.0.1"

echo "Addons directory: $ADDONS"

if [ -d "$TERRAIN" ]; then
  echo "Terrain3D already present at $TERRAIN"
else
  echo "Cloning Terrain3D ($TAG)..."
  git clone --depth 1 --branch "$TAG" "$REPO" "$TERRAIN"
  echo "Terrain3D installed."
fi

echo
echo "Next steps:"
echo "  1. Open game/ in Godot 4.4+"
echo "  2. Project > Project Settings > Plugins > enable Terrain3D"
echo "  3. Press F5 to run (island heightmap imports automatically at runtime)"
