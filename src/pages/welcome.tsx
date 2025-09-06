// pages/welcome.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuthStatus } from "@/lib/useAuthStatus";
import { useUsername } from "@/lib/useUsername";
import {
  addPlayerToSession,
  setMode,
  setRoundLoading,
  finalizeQuestionRound,
  finalizeCodewordRound,
  updatePlayerSuggestion,
  resetSession,
  type PlayersMap,
  type SessionMode,
  type SessionDoc,
} from "@/lib/firebase.firestore";
import { useSession } from "@/lib/useSession";

const MODES: SessionMode[] = ["codeword", "question", "unset"];
const SPY_ID = "6MSPlUSzGiXeRePaudQzt5VOuN13"; // hardcoded per requirement

export default function WelcomePage() {
  const auth = useAuthStatus(); // includes .isAdmin
  const { status: nameStatus, username, save } = useUsername(); // <-- get save()
  const session = useSession(); // SessionDoc | null while loading

  const [joining, setJoining] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false); // admin reset state

  const isSignedIn = auth.state === "signed-in";
  const isAdmin = isSignedIn && auth.isAdmin;

  const players: PlayersMap = useMemo(() => session?.players ?? {}, [session]);
  const totalPlayers = Object.keys(players).length;

  const uid = isSignedIn ? auth.user.uid : null;
  const joined = uid ? !!players[uid] : false;

  // local controlled value for suggestion; seed from session on change
  const [mySuggestion, setMySuggestion] = useState("");
  useEffect(() => {
    if (joined && uid) {
      setMySuggestion(players[uid]?.suggestion ?? "");
    } else {
      setMySuggestion("");
    }
  }, [joined, uid, players]);

  // local editable username for join panel
  const [joinName, setJoinName] = useState(username ?? "");
  useEffect(() => {
    // If user hasn't joined yet, keep the join input in sync with account username
    if (!joined) setJoinName(username ?? "");
  }, [username, joined]);

  async function handleJoin() {
    if (!isSignedIn || !uid) return;
    const clean = (joinName ?? "").trim();
    if (!clean) {
      setErr("Please enter a username.");
      return;
    }
    setErr(null);
    setJoining(true);
    try {
      // If they changed their username, persist it first
      if (clean !== (username ?? "")) {
        await save(clean);
      }
      await addPlayerToSession(uid, clean); // suggestion defaults to ""
    } catch (e: any) {
      setErr(e?.message || "Failed to join.");
    } finally {
      setJoining(false);
    }
  }

  async function handleSetMode(m: SessionMode) {
    try {
      await setMode(m);
      await handleNext(m);
    } catch (e: any) {
      setErr(e?.message || "Failed to set mode.");
    }
  }

  // ADMIN "Next": set loading:true, then timeout -> placeholders + loading:false
  async function handleNext(sessionMode?: SessionMode) {
    const __session = sessionMode ? { ...session, mode: sessionMode } : session;
    if (!__session) return;
    if (__session.mode !== "question" && __session.mode !== "codeword") return;

    await setRoundLoading(__session.mode);

    setTimeout(async () => {
      try {
        if (__session.mode === "question") {
          await finalizeQuestionRound({
            players,
            spy: SPY_ID,
            realQuestion: "How many takeout meals do you order in a typical week?",
            spyQuestion: "How many late-night snacks do you sneak in a typical week?",
          });
        } else {
          await finalizeCodewordRound({
            players,
            spy: SPY_ID,
            topic: "What you bring to a BBQ",
            codeword: "marshmallow",
          });
        }
      } catch {
        // minimal changes: no extra handling
      }
    }, 600);
  }

  // suggestion change -> update firestore entry under players[uid]
  async function handleSuggestionChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setMySuggestion(v);
    if (joined && uid) {
      try {
        await updatePlayerSuggestion(uid, v);
      } catch {
        // keep UI responsive
      }
    }
  }

  // Admin: reset current session
  async function handleReset() {
    if (!isAdmin) return;
    if (!confirm("Reset the current session? This clears players and mode.")) return;
    setResetting(true);
    try {
      await resetSession();
    } finally {
      setResetting(false);
    }
  }

  // Require: signed-in, has-username, and session snapshot loaded
  const loadingGate = !(isSignedIn && nameStatus === "has-username" && session !== null);
  if (loadingGate) {
    return (
      <main style={{ maxWidth: 720, margin: "2rem auto", padding: "1rem" }}>
        <p>Loading…</p>
      </main>
    );
  }

  const isSpy = (session as any).spy && uid ? (session as any).spy === uid : false;

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

        {/* Mode chip + loading indicator */}
        <div
          style={{
            display: "inline-block",
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #ddd",
            color: "#333",
          }}
        >
          Mode:{" "}
          <b style={{ textTransform: "capitalize" }}>
            {session!.mode}
            {("loading" in (session as any) && (session as any).loading === true) ? " (loading)" : ""}
          </b>
        </div>

        {/* Player count — visible to everyone */}
        <div style={{ color: "#666", fontSize: 14 }}>
          Players: <b>{totalPlayers}</b>
        </div>
      </div>

      {/* ADMIN: mode controls + Next + Reset */}
      {isAdmin && (
        <section
          style={{
            border: "1px solid #eee",
            borderRadius: 8,
            padding: 16,
            marginTop: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 600 }}>Controls</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(["codeword", "question", "unset"] as const).map((m) => (
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
              {(session.mode === "question" || session.mode === "codeword") && (
                <button
                  onClick={() => handleNext()}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #ccc",
                    background: "white",
                  }}
                >
                  Next
                </button>
              )}
              <button
                onClick={handleReset}
                disabled={resetting}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #e11",
                  background: resetting ? "#fee" : "white",
                  color: "#b00",
                }}
              >
                {resetting ? "Resetting…" : "Reset Session"}
              </button>
            </div>
          </div>

          {/* Admin-only player list, alphabetized by username */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Players</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {totalPlayers > 0 ? (
                Object.entries(players)
                  .sort(([, a], [, b]) => a.username.localeCompare(b.username))
                  .map(([pid, p]) => <li key={pid}>{p.username}</li>)
              ) : (
                <li>No players yet.</li>
              )}
            </ul>
          </div>
        </section>
      )}

      {/* Player suggestion input (joined players only) */}
      {joined && (
        <section
          style={{
            border: "1px solid #eee",
            borderRadius: 8,
            padding: 16,
            marginTop: 16,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Your suggestion</div>
          <textarea
            rows={3}
            value={mySuggestion}
            onChange={handleSuggestionChange}
            placeholder="Type your suggestion…"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #ccc",
              resize: "vertical",
            }}
          />
          <p style={{ color: "#666", fontSize: 12, marginTop: 6 }}>
            Everyone’s suggestion is saved under their player entry.
          </p>
        </section>
      )}

      {/* Round display */}
      {session.mode === "question" && (
        <section
          style={{
            border: "1px solid #eee",
            borderRadius: 8,
            padding: 16,
            marginTop: 16,
          }}
        >
          {(session as Extract<SessionDoc, { mode: "question" }>).loading ? (
            <p>Loading next question…</p>
          ) : (
            <>
              {((session as any).spy && uid && (session as any).spy === uid) ? (
                <p>
                  <b>Your spy question:</b>{" "}
                  {
                    (session as Extract<
                      SessionDoc,
                      { mode: "question"; loading: false }
                    >).spyQuestion
                  }
                </p>
              ) : (
                <p>
                  <b>Your question:</b>{" "}
                  {
                    (session as Extract<
                      SessionDoc,
                      { mode: "question"; loading: false }
                    >).realQuestion
                  }
                </p>
              )}
            </>
          )}
        </section>
      )}

      {session.mode === "codeword" && (
        <section
          style={{
            border: "1px solid #eee",
            borderRadius: 8,
            padding: 16,
            marginTop: 16,
          }}
        >
          {(session as Extract<SessionDoc, { mode: "codeword" }>).loading ? (
            <p>Loading next codeword round…</p>
          ) : (
            <>
              <p>
                <b>Topic:</b>{" "}
                {
                  (session as Extract<
                    SessionDoc,
                    { mode: "codeword"; loading: false }
                  >).topic
                }
              </p>
              {((session as any).spy && uid && (session as any).spy === uid) ? (
                <p>
                  <i>You are the spy — no codeword shown.</i>
                </p>
              ) : (
                <p>
                  <b>Codeword:</b>{" "}
                  {
                    (session as Extract<
                      SessionDoc,
                      { mode: "codeword"; loading: false }
                    >).codeword
                  }
                </p>
              )}
            </>
          )}
        </section>
      )}

      {/* Join panel (now with editable username) */}
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
            <p style={{ marginBottom: 12 }}>
              Update your username if needed, then tap below to join the current session.
            </p>
            <div style={{ display: "grid", gap: 8, maxWidth: 420 }}>
              <input
                type="text"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="Username"
                minLength={2}
                maxLength={40}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid #ccc",
                }}
              />
              <button
                onClick={handleJoin}
                disabled={joining || !joinName.trim()}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: "black",
                  color: "white",
                  opacity: !joinName.trim() ? 0.6 : 1,
                }}
              >
                {joining ? "Joining…" : "Join"}
              </button>
            </div>
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
