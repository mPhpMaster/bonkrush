export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";

type Row = {
  display_name: string;
  level: number;
  coins: number;
  wild_kills: number;
  catches: number;
};

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("trainer_board")
    .select("display_name, level, coins, wild_kills, catches")
    .order("level", { ascending: false })
    .order("wild_kills", { ascending: false })
    .limit(25);

  const rows = (data ?? []) as Row[];

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Trainer Board</h1>
      <p style={{ color: "var(--muted)" }}>
        Play the Godot client while logged in. Wins and catches publish here so you can compete with friends.
      </p>
      {rows.length === 0 ? (
        <div className="card">No scores yet. Be the first trainer on the island.</div>
      ) : (
        <div className="card" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                <th style={{ padding: "0.5rem" }}>#</th>
                <th style={{ padding: "0.5rem" }}>Trainer</th>
                <th style={{ padding: "0.5rem" }}>Lv</th>
                <th style={{ padding: "0.5rem" }}>Kills</th>
                <th style={{ padding: "0.5rem" }}>Caught</th>
                <th style={{ padding: "0.5rem" }}>Coins</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.display_name + i} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.65rem 0.5rem" }}>{i + 1}</td>
                  <td style={{ padding: "0.65rem 0.5rem", fontWeight: 700 }}>{r.display_name}</td>
                  <td style={{ padding: "0.65rem 0.5rem" }}>{r.level}</td>
                  <td style={{ padding: "0.65rem 0.5rem" }}>{r.wild_kills}</td>
                  <td style={{ padding: "0.65rem 0.5rem" }}>{r.catches}</td>
                  <td style={{ padding: "0.65rem 0.5rem" }}>{r.coins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
