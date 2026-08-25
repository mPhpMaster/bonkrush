export const dynamic = "force-dynamic";
import { AddToPartyButton } from "@/components/AddToPartyButton";
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

export default async function CollectionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: chars } = await supabase
    .from("characters")
    .select("id")
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

  const { data: partyRows } = await supabase
    .from("player_monsters")
    .select("id")
    .eq("character_id", char.id)
    .gte("slot", 0);

  const partyCount = partyRows?.length ?? 0;

  const { data: monsters } = await supabase
    .from("player_monsters")
    .select("*, monster_species(*)")
    .eq("character_id", char.id)
    .lt("slot", 0)
    .order("created_at");

  const collection = (monsters ?? []) as Monster[];

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Collection</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Monsters caught in the wild. Party slots: {partyCount}/4 — manage active monster on{" "}
        <a href="/party">Party</a>.
      </p>

      {collection.length === 0 ? (
        <div className="card">
          <p style={{ color: "var(--muted)" }}>No monsters in your collection yet. Fight wild monsters in the game to catch them!</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "1rem" }}>
          {collection.map((m) => (
            <MonsterCard key={m.id} monster={m} characterId={char.id} partyCount={partyCount} />
          ))}
        </div>
      )}
    </div>
  );
}

function MonsterCard({
  monster: m,
  characterId,
  partyCount,
}: {
  monster: Monster;
  characterId: string;
  partyCount: number;
}) {
  const s = m.monster_species;
  if (!s) return null;
  const color = TYPE_COLORS[s.type] ?? "#888";
  const emoji = TYPE_EMOJI[s.type] ?? "❓";
  const xpNeeded = 50 * m.level;

  return (
    <div
      className="card"
      style={{
        borderLeft: `4px solid ${color}`,
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: "1.8rem" }}>{emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>{s.name}</div>
          <div style={{ color, fontSize: "0.8rem" }}>{s.type.toUpperCase()}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>Lv.{m.level}</div>
          <AddToPartyButton characterId={characterId} monsterId={m.id} partyCount={partyCount} />
        </div>
      </div>

      <div style={{ marginTop: "0.75rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.25rem", fontSize: "0.85rem" }}>
        <Stat label="HP" value={calcStat(s.base_hp, m.level)} />
        <Stat label="ATK" value={calcStat(s.base_attack, m.level)} />
        <Stat label="DEF" value={calcStat(s.base_defense, m.level)} />
        <Stat label="SPD" value={calcStat(s.base_speed, m.level)} />
      </div>

      <div style={{ marginTop: "0.5rem" }}>
        <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
          XP: {m.xp} / {xpNeeded}
        </div>
        <div style={{ background: "var(--border)", borderRadius: 4, height: 6, marginTop: 3 }}>
          <div
            style={{
              width: `${Math.min(100, (m.xp / xpNeeded) * 100)}%`,
              background: color,
              height: "100%",
              borderRadius: 4,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span style={{ color: "var(--muted)" }}>{label}: </span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
