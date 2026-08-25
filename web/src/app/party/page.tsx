export const dynamic = "force-dynamic";
import { SetActiveButton } from "@/components/SetActiveButton";
import { RemoveFromPartyButton } from "@/components/RemoveFromPartyButton";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const TYPE_COLORS: Record<string, string> = {
  fire: "#ff5722", water: "#2196f3", grass: "#4caf50",
  electric: "#ffc107", psychic: "#e91e9a", dark: "#9c27b0", wind: "#80deea",
};

const TYPE_EMOJI: Record<string, string> = {
  fire: "🔥", water: "💧", grass: "🌿", electric: "⚡",
  psychic: "🔮", dark: "🌑", wind: "🌬",
};

type Monster = {
  id: string;
  species_id: string;
  level: number;
  xp: number;
  is_active: boolean;
  slot: number;
  current_hp: number | null;
  monster_species: {
    name: string;
    type: string;
    base_hp: number;
    base_attack: number;
    base_defense: number;
    base_speed: number;
  } | null;
};

function calcStat(base: number, level: number) {
  return Math.floor(base * (1 + 0.08 * (level - 1)));
}

export default async function PartyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: chars } = await supabase
    .from("characters")
    .select("id, coins")
    .eq("user_id", user.id)
    .limit(1);

  const char = chars?.[0];
  if (!char) {
    return (
      <div className="card">
        <p>No character found. Create one in the game client.</p>
      </div>
    );
  }

  const { data: monsters } = await supabase
    .from("player_monsters")
    .select("*, monster_species(*)")
    .eq("character_id", char.id)
    .gte("slot", 0)
    .order("slot");

  const party = (monsters ?? []) as Monster[];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0 }}>Party</h1>
        <span
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "0.2rem 0.7rem",
            fontWeight: 700,
          }}
        >
          🪙 {char.coins} Coins
        </span>
      </div>

      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Your battle team (up to 4 slots). The active monster fights alongside you in-game.
      </p>

      {party.length === 0 ? (
        <div className="card">
          <p style={{ color: "var(--muted)" }}>
            No party monsters yet. Your starter appears here after character creation in the game client.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {party.map((m) => (
            <PartyRow key={m.id} monster={m} characterId={char.id} partySize={party.length} />
          ))}
        </div>
      )}
    </div>
  );
}

function PartyRow({
  monster: m,
  characterId,
  partySize,
}: {
  monster: Monster;
  characterId: string;
  partySize: number;
}) {
  const s = m.monster_species;
  if (!s) return null;

  const color = TYPE_COLORS[s.type] ?? "#888";
  const emoji = TYPE_EMOJI[s.type] ?? "❓";
  const maxHp = calcStat(s.base_hp, m.level);
  const hp = m.current_hp ?? maxHp;
  const xpNeeded = 50 * m.level;

  return (
    <div
      className="card"
      style={{
        borderLeft: `4px solid ${color}`,
        display: "flex",
        alignItems: "center",
        gap: "1rem",
      }}
    >
      <span style={{ fontSize: "1.6rem" }}>{emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
          <span style={{ fontWeight: 700 }}>{s.name}</span>
          <span style={{ color, fontSize: "0.8rem" }}>{s.type.toUpperCase()}</span>
          <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>Slot {m.slot + 1}</span>
        </div>
        <div style={{ fontSize: "0.9rem", marginTop: "0.25rem" }}>
          Lv.{m.level} · HP {hp}/{maxHp} · XP {m.xp}/{xpNeeded}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, auto)", gap: "0.75rem", fontSize: "0.8rem", marginTop: "0.35rem" }}>
          <span>ATK {calcStat(s.base_attack, m.level)}</span>
          <span>DEF {calcStat(s.base_defense, m.level)}</span>
          <span>SPD {calcStat(s.base_speed, m.level)}</span>
        </div>
      </div>
      <SetActiveButton characterId={characterId} slot={m.slot} isActive={m.is_active} />
      {!m.is_active && partySize > 1 ? (
        <RemoveFromPartyButton characterId={characterId} monsterId={m.id} />
      ) : null}
    </div>
  );
}
