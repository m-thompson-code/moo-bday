// lib/firebase.firestore.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { firebaseConfig } from "./firebase.config";

// --- Initialize Firebase (safe across modules) ---
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);

// =========================
// Types & constants
// =========================
export type SessionMode = "codeword" | "question" | "unset";

export type Player = { username: string; suggestion: string }; // <-- updated
export type PlayersMap = Record<string, Player>;

/** UPDATED per your spec (minimal viable union form) */
export type SessionDoc =
  | {
      mode: "unset";
      players: PlayersMap;
      /** Optional spy uid; omitted by default on new session creation. */
      spy?: never;
    }
  | (
      | {
          mode: "question";
          loading: true;
          players: PlayersMap;
          spy?: never;
        }
      | {
          mode: "question";
          loading: false;
          players: PlayersMap;
          realQuestion: string;
          spyQuestion: string;
          spy: string;
          suggestion?: {
            suggestedBy: string;
            text: string;
          };
        }
    )
  | (
      | {
          mode: "codeword";
          loading: true;
          players: PlayersMap;
          spy?: never;
        }
      | {
          mode: "codeword";
          loading: false;
          players: PlayersMap;
          topic: string;
          codeword: string;
          spy: string;
          suggestion?: {
            suggestedBy: string;
            text: string;
          };
        }
    );

const SESSION_ID = "current"; // single global session document
export function sessionRef() {
  return doc(db, "sessions", SESSION_ID);
}

// =========================
// User profile helpers
// =========================
export async function fetchUsername(uid: string): Promise<string | null> {
  const uref = doc(db, "users", uid);
  const snap = await getDoc(uref);
  if (!snap.exists()) return null;
  const v = snap.get("username");
  return typeof v === "string" && v.trim().length ? v.trim() : null;
}

export async function setUsername(uid: string, username: string) {
  const uref = doc(db, "users", uid);
  await setDoc(uref, { username: (username ?? "").trim() }, { merge: true });
}

// =========================
// Session helpers
// =========================

/** Live listener; defaults to safe shape if doc/fields missing. */
export function listenSession(cb: (s: SessionDoc | null) => void): Unsubscribe {
  return onSnapshot(sessionRef(), (snap) => {
    if (!snap.exists()) {
      cb({ mode: "unset", players: {} });
      return;
    }
    const raw = snap.data() as any;

    if (raw.mode === "question") {
      if (raw.loading === true) {
        cb({ mode: "question", loading: true, players: raw.players ?? {} });
        return;
      }
      if (raw.loading === false) {
        cb({
          mode: "question",
          loading: false,
          players: raw.players ?? {},
          realQuestion: String(raw.realQuestion ?? "Placeholder real question"),
          spyQuestion: String(raw.spyQuestion ?? "Placeholder spy question"),
          spy: String(raw.spy ?? ""),
          suggestion: raw.suggestion,
        });
        return;
      }
      cb({ mode: "question", loading: true, players: raw.players ?? {} });
      return;
    }

    if (raw.mode === "codeword") {
      if (raw.loading === true) {
        cb({ mode: "codeword", loading: true, players: raw.players ?? {} });
        return;
      }
      if (raw.loading === false) {
        cb({
          mode: "codeword",
          loading: false,
          players: raw.players ?? {},
          topic: String(raw.topic ?? "Placeholder topic"),
          codeword: String(raw.codeword ?? "Placeholder codeword"),
          spy: String(raw.spy ?? ""),
          suggestion: raw.suggestion,
        });
        return;
      }
      cb({ mode: "codeword", loading: true, players: raw.players ?? {} });
      return;
    }

    cb({ mode: "unset", players: raw.players ?? {} });
  });
}

/** Set the current mode. Starts rounds at loading:true. */
export async function setMode(mode: SessionMode) {
  if (mode === "unset") {
    await setDoc(sessionRef(), { mode: "unset" }, { merge: true });
  } else {
    await setDoc(sessionRef(), { mode, loading: true }, { merge: true });
  }
}

/** Reset to clean base. */
export async function resetSession() {
  await setDoc(sessionRef(), { mode: "unset", players: {} } as SessionDoc, {
    merge: false,
  });
}

// =========================
// Players helpers (write whole "players" map)
// =========================

/** Whole-map write, never dotted paths. Creates doc if missing. */
export async function addPlayerToSession(uid: string, username: string) {
  const ref = sessionRef();
  const snap = await getDoc(ref);
  const current: PlayersMap = snap.exists() ? (snap.data() as any).players ?? {} : {};
  const next: PlayersMap = {
    ...current,
    [uid]: { username, suggestion: "" }, // <-- default suggestion = ""
  };

  if (snap.exists()) {
    await setDoc(ref, { players: next }, { merge: true });
  } else {
    await setDoc(ref, { mode: "unset", players: next }, { merge: true });
  }
}

/** Update only a player's suggestion (whole-map write, no dotted paths). */
export async function updatePlayerSuggestion(uid: string, suggestion: string) {
  const ref = sessionRef();
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const current: PlayersMap = (snap.data() as any).players ?? {};
  if (!current || typeof current !== "object" || !current[uid]) return;

  const player = current[uid];
  const next: PlayersMap = {
    ...current,
    [uid]: { ...player, suggestion },
  };

  await setDoc(ref, { players: next }, { merge: true });
}

// =========================
// Round helpers (unchanged except types accept PlayersMap with suggestion)
// =========================

export async function setRoundLoading(mode: "question" | "codeword") {
  await setDoc(sessionRef(), { mode, loading: true }, { merge: true });
}

export async function finalizeQuestionRound(payload: {
  players: PlayersMap;
  realQuestion: string;
  spyQuestion: string;
  spy: string;
  suggestion?: { suggestedBy: string; text: string };
}) {
  await setDoc(
    sessionRef(),
    {
      mode: "question",
      loading: false,
      players: payload.players,
      realQuestion: payload.realQuestion,
      spyQuestion: payload.spyQuestion,
      spy: payload.spy,
      ...(payload.suggestion ? { suggestion: payload.suggestion } : {}),
    } as SessionDoc,
    { merge: true }
  );
}

export async function finalizeCodewordRound(payload: {
  players: PlayersMap;
  topic: string;
  codeword: string;
  spy: string;
  suggestion?: { suggestedBy: string; text: string };
}) {
  await setDoc(
    sessionRef(),
    {
      mode: "codeword",
      loading: false,
      players: payload.players,
      topic: payload.topic,
      codeword: payload.codeword,
      spy: payload.spy,
      ...(payload.suggestion ? { suggestion: payload.suggestion } : {}),
    } as SessionDoc,
    { merge: true }
  );
}

// =========================
// Name/username FSM (unchan
