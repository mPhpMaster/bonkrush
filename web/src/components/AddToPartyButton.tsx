"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  characterId: string;
  monsterId: string;
  partyCount: number;
};

export function AddToPartyButton({ characterId, monsterId, partyCount }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (partyCount >= 4) {
    return (
      <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>Party full</span>
    );
  }

  async function addToParty() {
    if (loading) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("set_party_slot", {
      p_character_id: characterId,
      p_monster_id: monsterId,
      p_slot: partyCount,
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
        onClick={addToParty}
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
        {loading ? "Adding…" : "Add to Party"}
      </button>
      {error ? (
        <span style={{ color: "#ff6b6b", fontSize: "0.75rem", maxWidth: 140, textAlign: "right" }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
