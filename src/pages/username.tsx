// pages/username.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useAuthStatus } from "@/lib/useAuthStatus";
import { fetchUsername, setUsername } from "@/lib/firebase.firestore";

export default function UsernamePage() {
  const router = useRouter();
  const status = useAuthStatus();

  const redirectedRef = useRef(false);
  const [checking, setChecking] = useState(true);
  const [username, _setUsername] = useState("");
  const [saving, setSaving] = useState(false);

  // If already have a username, go to /welcome
  useEffect(() => {
    let on = true;
    if (!router.isReady || redirectedRef.current) return;
    if (status.state !== "signed-in") return; // wait until auth resolves

    (async () => {
      const name = await fetchUsername(status.user.uid);
      if (!on) return;

      if (name && router.pathname !== "/welcome") {
        redirectedRef.current = true;
        router.replace("/welcome");
        return;
      }
      setChecking(false);
    })();

    return () => {
      on = false;
    };
  }, [status, router]);

  const canSubmit = useMemo(
    () => status.state === "signed-in" && username.trim().length >= 2 && !saving,
    [status, username, saving]
  );

  async function saveUsername(e: React.FormEvent) {
    e.preventDefault();
    if (status.state !== "signed-in") return;

    setSaving(true);
    try {
      await setUsername(status.user.uid, username.trim());

      if (!redirectedRef.current && router.pathname !== "/welcome") {
        redirectedRef.current = true;
        router.replace("/welcome");
      }
    } finally {
      setSaving(false);
    }
  }

  if (status.state !== "signed-in" || checking) {
    return (
      <main style={{ maxWidth: 480, margin: "2rem auto", padding: "1rem" }}>
        <p>Preparing your session…</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: "2rem auto", padding: "1rem" }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>Choose a username</h1>
      <form onSubmit={saveUsername} style={{ display: "grid", gap: 12 }}>
        <input
          type="text"
          value={username}
          onChange={(e) => _setUsername(e.target.value)}
          minLength={2}
          required
          placeholder="e.g. pixel_panda"
          style={{ padding: 12, borderRadius: 8, border: "1px solid #ddd" }}
        />
        <button
          type="submit"
          disabled={!canSubmit}
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer" }}
        >
          {saving ? "Saving…" : "Save & continue"}
        </button>
      </form>
      <p style={{ color: "#666", fontSize: 14, marginTop: 8 }}>
        We’ll store this nickname in Firestore on your anonymous account.
      </p>
    </main>
  );
}
