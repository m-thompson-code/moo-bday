// pages/admin.tsx
import { useState } from "react";
import { useAuthStatus } from "@/lib/useAuthStatus";
import {
  signInWithFixedEmail,
  FIXED_SIGNIN_EMAIL,
  isAdminUser,
} from "@/lib/firebase.auth";

export default function AdminPage() {
  const status = useAuthStatus();

  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await signInWithFixedEmail(password);
      // status will update via onAuthStateChanged → useAuthStatus rerenders to show admin area
    } catch (e: any) {
      const code = e?.code as string | undefined;
      if (code === "auth/wrong-password") setErr("Incorrect password.");
      else if (code === "auth/user-not-found") setErr("Admin account not found.");
      else if (code === "auth/too-many-requests") setErr("Too many attempts. Try again later.");
      else if (code === "auth/invalid-api-key") setErr("Invalid Firebase config.");
      else setErr("Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // Loading states until auth store has a user (or anon)
  if (status.state === "idle") {
    return (
      <main style={{ maxWidth: 520, margin: "2rem auto", padding: "1rem" }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Admin</h1>
        <p>Preparing your session…</p>
      </main>
    );
  }

  const signedIn = status.state === "signed-in";
  const admin = signedIn && isAdminUser(status.user);

  // If admin, show the gated area
  if (admin) {
    return (
      <main style={{ maxWidth: 720, margin: "2rem auto", padding: "1rem" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>🛡️ Admin</h1>
        <p style={{ color: "#555", marginBottom: 16 }}>
          Signed in as <code>{status.user.email ?? "(no email)"}</code>
        </p>

        {/* Put your admin UI here */}
        <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 8 }}>
          <p style={{ margin: 0 }}>Admin access granted. Build your tools here.</p>
        </div>
      </main>
    );
  }

  // Otherwise, show the password-only login for the fixed email
  return (
    <main style={{ maxWidth: 520, margin: "2rem auto", padding: "1rem" }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Admin sign-in</h1>
      <p style={{ color: "#666", marginBottom: 16 }}>
        Email: <code>{FIXED_SIGNIN_EMAIL}</code>
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <input
          type="password"
          placeholder="Password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: 12, borderRadius: 8, border: "1px solid #ddd" }}
        />
        <button
          type="submit"
          disabled={busy || password.length === 0}
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer" }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {err && <p style={{ color: "#b00020", marginTop: 12 }}>{err}</p>}

      {signedIn && !admin && (
        <p style={{ color: "#666", fontSize: 13, marginTop: 12 }}>
          You’re currently signed in as{" "}
          <code>{status.user.email ?? (status.user.isAnonymous ? "anonymous user" : "(no email)")}</code>
          . Use the password above to access the admin account.
        </p>
      )}
    </main>
  );
}
