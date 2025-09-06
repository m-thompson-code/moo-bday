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

export type Player = {
  username: string;
};

export type PlayersMap = Record<string, Player>;

export type SessionDoc = {
  mode: SessionMode;
  players: PlayersMap;
  /** Optional spy uid; omitted by default on new session creation. */
  spy?: string;
};

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

/** Live listener for the single session document.
 * If the doc or some fields are missing, default to { mode: 'unset', players: {} }.
 */
export function listenSession(cb: (s: SessionDoc | null) => void): Unsubscribe {
  return onSnapshot(sessionRef(), (snap) => {
    if (!snap.exists()) {
      cb({ mode: "unset", players: {} });
      return;
    }
    const raw = snap.data() as Partial<SessionDoc> | undefined;
    const safe: SessionDoc = {
      mode: (raw?.mode as SessionMode) ?? "unset",
      players: (raw?.players as PlayersMap) ?? {},
      ...(raw && "spy" in raw ? { spy: raw.spy } : {}),
    };
    cb(safe);
  });
}

/** Set the current game mode. */
export async function setMode(mode: SessionMode) {
  await updateDoc(sessionRef(), { mode });
}

/** Reset the session to a clean state (spy omitted). */
export async function resetSession() {
  const payload: SessionDoc = { mode: "unset", players: {} };
  await setDoc(sessionRef(), payload, { merge: false });
}

// =========================
// Players helpers (write whole "players" map)
// =========================

/**
 * Add (or overwrite) a player in the session by replacing the entire `players` object.
 * NEVER uses dotted paths; always writes the whole `players` map.
 * If the doc doesn't exist yet, create it with defaults.
 * If it exists, preserve the current mode.
 */
export async function addPlayerToSession(uid: string, username: string) {
  const ref = sessionRef();
  const snap = await getDoc(ref);
  const current: PlayersMap = snap.exists()
    ? ((snap.data() as SessionDoc).players ?? {})
    : {};

  const next: PlayersMap = { ...current, [uid]: { username } };

  if (snap.exists()) {
    await setDoc(ref, { players: next }, { merge: true });
  } else {
    await setDoc(ref, { mode: "unset", players: next }, { merge: true });
  }
}

// =========================
// Name/username FSM (for useUsername hook)
// =========================

export type NameStatus =
  | { state: "idle" }
  | { state: "missing-username" }
  | { state: "has-username"; username: string };

let _nameStatus: NameStatus = { state: "idle" };
const _nameListeners = new Set<(s: NameStatus) => void>();
let _startedName = false;
let _authUnsub: (() => void) | null = null;

function emitName() {
  for (const l of _nameListeners) l(_nameStatus);
}

export function nameStatus(): NameStatus {
  return _nameStatus;
}

export function subscribeNameStatus(cb: (s: NameStatus) => void): () => void {
  _nameListeners.add(cb);
  return () => _nameListeners.delete(cb);
}

/** Idempotent: starts watching auth and user doc to track username availability. */
export function startNameStatus() {
  if (_startedName) return;
  _startedName = true;

  const auth = getAuth(app);
  _authUnsub = onAuthStateChanged(auth, async (u) => {
    if (!u) {
      _nameStatus = { state: "idle" };
      emitName();
      return;
    }
    const uname = await fetchUsername(u.uid);
    if (uname) {
      _nameStatus = { state: "has-username", username: uname };
    } else {
      _nameStatus = { state: "missing-username" };
    }
    emitName();
  });
}

/** Upserts username and moves FSM to has-username immediately. */
export async function upsertUsername(uid: string, username: string) {
  await setUsername(uid, username);
  _nameStatus = { state: "has-username", username: username.trim() };
  emitName();
}
