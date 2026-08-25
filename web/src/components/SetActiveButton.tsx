"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  characterId: string;
  slot: number;
  isActive: boolean;
};

export function SetActiveButton({ characterId, slot, isActive }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setActive() {
    if (isActive || loading) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("set_active_monster", {
      p_character_id: characterId,
      p_slot: slot,
    });

    setLoading(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.refresh();
  }

  if (isActive) {
    return (
      <span style={{ color: "#ffd700", fontWeight: 700, fontSize: "0.85rem" }}>
        ★ Active
      </span>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem" }}>
      <button
        type="button"
        onClick={setActive}
        disabled={loading}
        style={{
          background: "var(--accent)",
          border: "none",
          borderRadius: 6,
          color: "#fff",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1,
          padding: "0.35rem 0.75rem",
          fontWeight: 600,
        }}
      >
        {loading ? "Setting…" : "Set Active"}
      </button>
      {error ? (
        <span style={{ color: "#ff6b6b", fontSize: "0.75rem", maxWidth: 140, textAlign: "right" }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
