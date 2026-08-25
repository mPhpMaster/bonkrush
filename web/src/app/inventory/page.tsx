export const dynamic = "force-dynamic";
import { UseItemButton } from "@/components/UseItemButton";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type InventoryRow = {
  id: string;
  item_id: string;
  quantity: number;
  items: { name: string; description: string; effect_type: string; effect_val: number } | null;
};

export default async function InventoryPage() {
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
        <p>No character found.</p>
      </div>
    );
  }

  const { data: activeMonsters } = await supabase
    .from("player_monsters")
    .select("id, species_id, level, current_hp, is_active, monster_species(name, base_hp)")
    .eq("character_id", char.id)
    .eq("is_active", true)
    .limit(1);

  const activeMonster = activeMonsters?.[0] as {
    id: string;
    species_id: string;
    level: number;
    current_hp: number | null;
    monster_species: { name: string; base_hp: number } | null;
  } | undefined;

  const { data: inv } = await supabase
    .from("inventory")
    .select("*, items(*)")
    .eq("character_id", char.id)
    .gt("quantity", 0);

  const rows = (inv ?? []) as InventoryRow[];

  const maxHp = activeMonster
    ? Math.floor((activeMonster.monster_species?.base_hp ?? 60) * (1 + 0.08 * (activeMonster.level - 1)))
    : 0;
  const currentHp = activeMonster?.current_hp ?? maxHp;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0 }}>Inventory</h1>
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

      {activeMonster ? (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <div style={{ fontWeight: 700 }}>
            Active: {activeMonster.monster_species?.name ?? activeMonster.species_id} Lv.{activeMonster.level}
          </div>
          <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
            HP {currentHp} / {maxHp}
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: "1rem", color: "var(--muted)" }}>
          No active party monster — heal items need an active monster in-game.
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card">
          <p style={{ color: "var(--muted)" }}>Your inventory is empty. Win battles to earn coins and items.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {rows.map((row) => (
            <div
              key={row.id}
              className="card"
              style={{ display: "flex", alignItems: "center", gap: "1rem" }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{row.items?.name ?? row.item_id}</div>
                <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                  {row.items?.description}
                </div>
              </div>
              <div
                style={{
                  background: "var(--border)",
                  borderRadius: 6,
                  padding: "0.3rem 0.8rem",
                  fontWeight: 700,
                  minWidth: 40,
                  textAlign: "center",
                }}
              >
                ×{row.quantity}
              </div>
              {activeMonster && (row.items?.effect_type === "heal" || row.items?.effect_type === "full_heal") ? (
                <UseItemButton
                  itemId={row.item_id}
                  characterId={char.id}
                  monsterId={activeMonster.id}
                />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
