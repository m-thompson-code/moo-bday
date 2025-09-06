// pages/welcome.tsx
import { useMemo, useState } from "react";
import { useAuthStatus } from "@/lib/useAuthStatus";
import { useUsername } from "@/lib/useUsername";
import {
  addPlayerToSession,
  setMode,
  resetSession,
  type PlayersMap,
  type SessionMode,
} from "@/lib/firebase.firestore";
import { useSession } from "@/lib/useSession";

const MODES: SessionMode[] = ["codeword", "question", "unset"];

export default function WelcomePage() {
  const auth = useAuthStatus(); // includes .isAdmin
  const { status: nameStatus, username } = useUsername();
  const session = useSession(); // SessionDoc | null while loading

  const [joining, setJoining] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isSignedIn = auth.state === "signed-in";
  const isAdmin = isSignedIn && auth.isAdmin;

  // players is an OBJECT keyed by uid
  const players: PlayersMap = useMemo(() => session?.players ?? {}, [session]);
  const totalPlayers = Object.keys(players).length;

  const uid = isSignedIn ? auth.user.uid : null;
  const joined = uid ? !!players[uid] : false;

  // Show if current user matches session.spy
  const isSpy = !!uid && !!session?.spy && session.spy === uid;

  async function handleJoin() {
    if (!isSignedIn || !username || !uid) return;
    setErr(null);
    setJoining(true);
    try {
      await addPlayerToSession(uid, username);
      // useSession listener will refresh UI
    } catch (e: any) {
      setErr(e?.message || "Failed to join.");
    } finally {
      setJoining(false);
    }
  }

  async function handleSetMode(m: SessionMode) {
    try {
      await setMode(m);
    } catch (e: any) {
      setErr(e?.message || "Failed to set mode.");
    }
  }

  async function handleResetSession() {
    setErr(null);
    setResetting(true);
    try {
      await resetSession();
    } catch (e: any) {
      setErr(e?.message || "Failed to reset session.");
    } finally {
      setResetting(false);
    }
  }

  // Admin-only NEXT stub (only when a mode is selected)
  function handleNextStub() {
    // TODO: replace with real "advance to next step" logic later
    // You can route based on session?.mode when implemented
    alert(`Next step (stub) for mode: ${session?.mode ?? "unset"}`);
  }

  // Require: signed-in, has-username, and session snapshot loaded
  const loading = !(isSignedIn && nameStatus === "has-username" && session !== null);

  if (loading) {
    return (
      <main style={{ maxWidth: 720, margin: "2rem auto", padding: "1rem" }}>
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", padding: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>
          Welcome, {username} {isAdmin ? "👑" : "👋"}
        </h1>

        {/* Role chip */}
        <div
          style={{
            display: "inline-block",
            padding: "6px 10px",
            borderRadius: 8,
            fontWeight: 600,
            background: isAdmin ? "rgba(14, 122, 13, 0.08)" : "rgba(13, 99, 255, 0.08)",
            border: `1px solid ${isAdmin ? "#1a8f18" : "#0d63ff"}`,
            color: isAdmin ? "#1a8f18" : "#0d63ff",
          }}
        >
          {isAdmin ? "Admin" : "Player"}
        </div>

        {/* Mode chip */}
        <div
          style={{
            display: "inline-block",
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #ddd",
            color: "#333",
          }}
        >
          Mode: <b style={{ textTransform: "capitalize" }}>{session!.mode}</b>
        </div>

        {/* Spy chip */}
        {isSpy && (
          <div
            style={{
              display: "inline-block",
              padding: "6px 10px",
              borderRadius: 8,
              fontWeight: 600,
              background: "rgba(255, 193, 7, 0.12)",
              border: "1px solid #e0a800",
              color: "#a07800",
            }}
            title="You are the spy for this session"
          >
            🕵️ You are the spy
          </div>
        )}

        {/* Player count */}
        <div style={{ color: "#666", fontSize: 14 }}>
          Players: <b>{totalPlayers}</b>
        </div>
      </div>

      {/* ADMIN: mode controls + reset + next (stub) */}
      {isAdmin && (
        <section
          style={{
            border: "1px solid #eee",
            borderRadius: 8,
            padding: 16,
            marginTop: 16,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Set mode</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {MODES.map((m) => (
              <button
                key={m}
                onClick={() => handleSetMode(m)}
                disabled={session!.mode === m}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  background: session!.mode === m ? "#eee" : "white",
                  textTransform: "capitalize",
                  cursor: session!.mode === m ? "default" : "pointer",
                }}
              >
                {m}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={handleResetSession}
              disabled={resetting}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #ccc",
                background: "#fff",
              }}
              title="Reset to mode: unset and clear players (spy omitted)"
            >
              {resetting ? "Resetting…" : "Reset session"}
            </button>

            {/* Show NEXT only when a mode is selected (not 'unset') */}
            {session!.mode !== "unset" && (
              <button
                onClick={handleNextStub}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  background: "#fff",
                }}
                title="Proceed to the next step (stub)"
              >
                Next
              </button>
            )}
          </div>
        </section>
      )}

      {/* Players list */}
      <section
        style={{
          border: "1px solid #eee",
          borderRadius: 8,
          padding: 16,
          marginTop: 16,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Players</div>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {totalPlayers > 0 ? (
            Object.entries(players).map(([pid, p]) => (
              <li key={pid}>{p.username}</li>
            ))
          ) : (
            <li>No players yet.</li>
          )}
        </ul>
      </section>

      {/* Join panel */}
      <section
        style={{
          border: "1px solid #eee",
          borderRadius: 8,
          padding: 16,
          marginTop: 16,
        }}
      >
        {!joined ? (
          <>
            <p style={{ marginBottom: 12 }}>Tap below to join the current session.</p>
            <button
              onClick={handleJoin}
              disabled={joining}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                background: "black",
                color: "white",
              }}
            >
              {joining ? "Joining…" : "Join"}
            </button>
            {err && <p style={{ color: "#b00020", marginTop: 12 }}>{err}</p>}
          </>
        ) : (
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>You’re in! 🎉</div>
          </div>
        )}
      </section>
    </main>
  );
}
