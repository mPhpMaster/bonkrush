"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  characterId: string;
  monsterId: string;
  disabled?: boolean;
};

export function RemoveFromPartyButton({ characterId, monsterId, disabled }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function removeFromParty() {
    if (disabled || loading) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("set_party_slot", {
      p_character_id: characterId,
      p_monster_id: monsterId,
      p_slot: -1,
    });

    setLoading(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem" }}>
      <button
        type="button"
        onClick={removeFromParty}
        disabled={disabled || loading}
        style={{
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: 6,
          color: "inherit",
          cursor: disabled || loading ? "not-allowed" : "pointer",
          opacity: disabled || loading ? 0.6 : 1,
          padding: "0.35rem 0.75rem",
          fontWeight: 600,
        }}
      >
        {loading ? "Moving…" : "To Collection"}
      </button>
      {error ? (
        <span style={{ color: "#ff6b6b", fontSize: "0.75rem", maxWidth: 140, textAlign: "right" }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
