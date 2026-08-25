export const dynamic = "force-dynamic";
import { BuyItemButton } from "@/components/BuyItemButton";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const SHOP_ITEMS = [
  { id: "potion", name: "Potion", description: "Restores 30 HP to active monster.", price: 50 },
  { id: "super_potion", name: "Super Potion", description: "Restores 70 HP.", price: 120 },
  { id: "full_restore", name: "Full Restore", description: "Fully heals active monster.", price: 200 },
];

export default async function ShopPage() {
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
        <p>No character found. Create one in the Godot client first.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0 }}>Shrine Shop</h1>
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

      <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
        Buy healing items with coins earned from battles. In-game, visit the shrine spawn and press E.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {SHOP_ITEMS.map((item) => (
          <div
            key={item.id}
            className="card"
            style={{ display: "flex", alignItems: "center", gap: "1rem" }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{item.name}</div>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{item.description}</div>
            </div>
            <BuyItemButton
              itemId={item.id}
              characterId={char.id}
              price={item.price}
              coins={char.coins}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
