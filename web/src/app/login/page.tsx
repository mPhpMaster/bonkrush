"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      }
      router.push("/character");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: "4rem auto" }}>
      <div className="card">
        <h1 style={{ marginTop: 0, fontSize: "1.6rem" }}>
          {mode === "login" ? "Login" : "Create Account"}
        </h1>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {error && <p style={{ color: "var(--accent)", margin: 0 }}>{error}</p>}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "…" : mode === "login" ? "Login" : "Sign Up"}
          </button>
        </form>
        <p style={{ marginTop: "1rem", color: "var(--muted)", textAlign: "center" }}>
          {mode === "login" ? (
            <>No account?{" "}
              <button
                className="btn btn-ghost"
                onClick={() => setMode("signup")}
                style={{ padding: "0.2rem 0.5rem" }}
              >Sign Up</button>
            </>
          ) : (
            <>Have an account?{" "}
              <button
                className="btn btn-ghost"
                onClick={() => setMode("login")}
                style={{ padding: "0.2rem 0.5rem" }}
              >Login</button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
