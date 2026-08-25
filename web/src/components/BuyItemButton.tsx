"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  itemId: string;
  characterId: string;
  price: number;
  coins: number;
};

export function BuyItemButton({ itemId, characterId, price, coins }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const canAfford = coins >= price;

  async function buy() {
    if (!canAfford || loading) return;
    setLoading(true);
    setMessage(null);

    const supabase = createClient();
    const { data, error } = await supabase.rpc("buy_item", {
      p_item_id: itemId,
      p_character_id: characterId,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    const result = data as { coins?: number } | null;
    setMessage(result?.coins != null ? `Purchased! ${result.coins} coins left` : "Purchased!");
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem" }}>
      <button
        type="button"
        onClick={buy}
        disabled={!canAfford || loading}
        style={{
          background: canAfford ? "var(--accent)" : "var(--border)",
          border: "none",
          borderRadius: 6,
          color: "#fff",
          cursor: !canAfford || loading ? "not-allowed" : "pointer",
          opacity: !canAfford || loading ? 0.6 : 1,
          padding: "0.35rem 0.75rem",
          fontWeight: 600,
        }}
      >
        {loading ? "Buying…" : `Buy (${price})`}
      </button>
      {message ? (
        <span style={{ color: "var(--muted)", fontSize: "0.75rem", maxWidth: 160, textAlign: "right" }}>
          {message}
        </span>
      ) : null}
    </div>
  );
}
