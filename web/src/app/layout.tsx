import type { Metadata } from "next";
import { NavAuth } from "@/components/NavAuth";
import "./globals.css";
export const metadata: Metadata = {
  title: "3D Monster RPG",
  description: "Catch, train, and battle monsters in a 3D world.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <nav
          style={{
            background: "linear-gradient(180deg, #1b1e30, #12141f)",
            borderBottom: "1px solid var(--border)",
            padding: "0.85rem 1.5rem",
            display: "flex",
            gap: "1.25rem",
            alignItems: "center",
          }}
        >
          <a href="/" style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--accent)" }}>
            ⚔ Monster RPG
          </a>
          <a href="/leaderboard">Board</a>
          <a href="/character">Character</a>
          <a href="/party">Party</a>
          <a href="/collection">Collection</a>
          <a href="/inventory">Inventory</a>
          <a href="/shop">Shop</a>
          <div style={{ flex: 1 }} />
          <NavAuth />
        </nav>
        <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1rem" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
