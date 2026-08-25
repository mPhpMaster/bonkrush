export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const TYPE_COLORS: Record<string, string> = {
  fire: "#ff5722", water: "#2196f3", grass: "#4caf50",
  electric: "#ffc107", psychic: "#e91e9a", dark: "#9c27b0", wind: "#80deea",
};

export default async function CharacterPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: chars } = await supabase
    .from("characters")
    .select("*")
    .eq("user_id", user.id)
    .limit(1);

  const char = chars?.[0];

  if (!char) {
    return (
      <div className="card">
        <h1 style={{ marginTop: 0 }}>No Character Yet</h1>
        <p style={{ color: "var(--muted)" }}>
          Open the game client to create your character and pick a starter monster.
        </p>
      </div>
    );
  }

  const typeColor = TYPE_COLORS[char.starter_type] ?? "#888";
  const xpNeeded = 50 * char.level;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>
        {char.name}
        <span
          style={{
            marginLeft: "0.75rem",
            fontSize: "0.8em",
            color: typeColor,
            border: `1px solid ${typeColor}`,
            borderRadius: 4,
            padding: "0.1rem 0.4rem",
          }}
        >
          {char.starter_type.toUpperCase()}
        </span>
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
        <StatCard label="Level" value={char.level} />
        <StatCard label="XP" value={`${char.xp} / ${xpNeeded}`} />
        <StatCard label="Coins" value={`${char.coins} 🪙`} />
      </div>

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>XP Progress</h2>
        <div
          style={{
            background: "var(--border)",
            borderRadius: 8,
            height: 18,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.min(100, (char.xp / xpNeeded) * 100)}%`,
              background: typeColor,
              height: "100%",
              transition: "width 0.3s",
            }}
          />
        </div>
        <p style={{ color: "var(--muted)", marginBottom: 0 }}>
          {char.xp} / {xpNeeded} XP to level {char.level + 1}
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card" style={{ textAlign: "center" }}>
      <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{label}</div>
      <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{value}</div>
    </div>
  );
}
