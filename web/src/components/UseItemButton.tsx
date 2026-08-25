"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  itemId: string;
  characterId: string;
  monsterId: string;
  disabled?: boolean;
};

export function UseItemButton({ itemId, characterId, monsterId, disabled }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function useItem() {
    if (disabled || loading) return;
    setLoading(true);
    setMessage(null);

    const supabase = createClient();
    const { data, error } = await supabase.rpc("use_item", {
      p_item_id: itemId,
      p_character_id: characterId,
      p_monster_id: monsterId,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    const result = data as { effect_type?: string; new_hp?: number } | null;
    if (result?.effect_type === "heal" && result.new_hp) {
      setMessage(`Healed active monster to ${result.new_hp} HP`);
    } else {
      setMessage("Item used");
    }

    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem" }}>
      <button
        type="button"
        onClick={useItem}
        disabled={disabled || loading}
        style={{
          background: "var(--accent)",
          border: "none",
          borderRadius: 6,
          color: "#fff",
          cursor: disabled || loading ? "not-allowed" : "pointer",
          opacity: disabled || loading ? 0.6 : 1,
          padding: "0.35rem 0.75rem",
          fontWeight: 600,
        }}
      >
        {loading ? "Using…" : "Use"}
      </button>
      {message ? (
        <span style={{ color: "var(--muted)", fontSize: "0.75rem", maxWidth: 140, textAlign: "right" }}>
          {message}
        </span>
      ) : null}
    </div>
  );
}
