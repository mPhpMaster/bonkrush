export default function Home() {
  const types = [
    { name: "Fire", color: "#ff5722", emoji: "🔥" },
    { name: "Water", color: "#2196f3", emoji: "💧" },
    { name: "Grass", color: "#4caf50", emoji: "🌿" },
    { name: "Electric", color: "#ffc107", emoji: "⚡" },
    { name: "Psychic", color: "#e91e9a", emoji: "🔮" },
    { name: "Dark", color: "#9c27b0", emoji: "🌑" },
    { name: "Wind", color: "#80deea", emoji: "🌬" },
  ];

  return (
    <div>
      <div style={{ textAlign: "center", padding: "3.5rem 0 2rem" }}>
        <p style={{ color: "var(--accent)", letterSpacing: "0.2em", fontWeight: 700, margin: 0 }}>
          PROTOTYPE  ·  OPEN PLAYTEST
        </p>
        <h1 style={{ fontSize: "2.7rem", margin: "0.6rem 0 0", color: "var(--accent)" }}>
          3D Monster RPG
        </h1>
        <p style={{ color: "var(--muted)", marginTop: "0.75rem", fontSize: "1.15rem", maxWidth: 640, marginLeft: "auto", marginRight: "auto" }}>
          Catch, train, and battle on a shared island. Create an account, play the Godot client, then race your friends on the trainer board.
        </p>
        <div style={{ display: "flex", gap: "0.85rem", justifyContent: "center", marginTop: "1.6rem", flexWrap: "wrap" }}>
          <a href="/login" className="btn">Create account</a>
          <a href="/leaderboard" className="btn btn-ghost">Leaderboard</a>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Play with friends (v0.1)</h2>
        <ol style={{ color: "var(--muted)", lineHeight: 1.9, marginBottom: 0 }}>
          <li>Each friend signs up here (email + password).</li>
          <li>Install <a href="https://godotengine.org/download">Godot 4.7</a> and open the <code>game/</code> folder — or run <code>pwsh scripts/run_game.ps1</code>.</li>
          <li>Log in with the same account in the game, create a trainer, fight near the shrine.</li>
          <li>Wins and catches appear on the <a href="/leaderboard">leaderboard</a>.</li>
        </ol>
        <p style={{ color: "var(--muted)", marginBottom: 0, marginTop: "1rem" }}>
          This build is <strong>async</strong>: same world, same accounts — not a live 4-player session yet.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginTop: "1.5rem" }}>
        {types.map((t) => (
          <div key={t.name} className="card" style={{ borderLeft: `4px solid ${t.color}`, textAlign: "center" }}>
            <div style={{ fontSize: "2rem" }}>{t.emoji}</div>
            <div style={{ color: t.color, fontWeight: 700, marginTop: "0.3rem" }}>{t.name}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>In-game controls</h2>
        <p style={{ color: "var(--muted)", lineHeight: 1.9, marginBottom: 0 }}>
          <kbd>WASD</kbd> move · <kbd>Esc</kbd> camera · wheel zoom · <kbd>1/2/3</kbd> attack / special / heal ·
          <kbd>I</kbd> bag · <kbd>C</kbd> caught · <kbd>P</kbd> party · <kbd>E</kbd> shrine shop · <kbd>H</kbd> help
        </p>
      </div>
    </div>
  );
}
