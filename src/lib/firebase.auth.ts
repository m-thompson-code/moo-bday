// lib/firebase.auth.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { firebaseConfig } from "./firebase.config";

// Initialize Firebase app (safe to call in multiple modules)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// 3-state auth status
export type AuthStatus =
  | { state: "idle" }                  // not started
  | { state: "signed-in"; user: User } // started & signed in
  | { state: "signed-out" };           // started & not signed in

let _status: AuthStatus = { state: "idle" };
let _started = false;
let _fbUnsub: (() => void) | null = null;

// Multi-listener pub/sub
type Listener = (s: AuthStatus) => void;
const listeners = new Set<Listener>();
function notify() { for (const l of listeners) l(_status); console.log("Auth status changed:", _status); }
export function subscribeAuth(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function authStatus(): AuthStatus { return _status; }

function setSignedIn(u: User) { _status = { state: "signed-in", user: u }; notify(); }
function setSignedOut() { _status = { state: "signed-out" }; notify(); }

/**
 * Start auth once (fire-and-forget).
 * IMPORTANT: We do NOT check auth.currentUser synchronously.
 * We wait for the FIRST onAuthStateChanged event so persisted sessions restore correctly.
 * Only if the first event is null do we create an anonymous session.
 */
export function startAuth(): void {
  if (_started) return;
  _started = true;
  if (typeof window === "undefined") return; // SSR guard

  // Ensure local persistence (before any sign-in)
  setPersistence(auth, browserLocalPersistence).catch(() => {});

  if (!_fbUnsub) {
    let firstEmission = true;
    _fbUnsub = onAuthStateChanged(auth, (u) => {
      if (u) setSignedIn(u);
      else setSignedOut();

      // After persistence restores (first emission), decide about anon creation
      if (firstEmission) {
        firstEmission = false;
        if (!u) {
          // Truly no session → create anonymous user
          signInAnonymously(auth).catch(() => {
            // If anonymous is disabled, remain signed-out until a real login.
          });
        }
      }
    });
  }
}

// Admin utilities & sign-in/out helpers (single admin)
export const FIXED_SIGNIN_EMAIL = "moomoomamoo@gmail.com"; // your admin email

function normalizeEmail(s?: string | null) {
  return (s ?? "").trim().toLowerCase();
}

/** True iff the user is the single admin (you). */
export function isAdminUser(u: User | null | undefined): boolean {
  return !!u?.email && normalizeEmail(u.email) === normalizeEmail(FIXED_SIGNIN_EMAIL);
}

/** Sign in as the fixed admin email using only a password. */
export async function signInWithFixedEmail(password: string) {
  await setPersistence(auth, browserLocalPersistence);
  const cred = await signInWithEmailAndPassword(auth, FIXED_SIGNIN_EMAIL, password);
  return cred.user; // _status updates via onAuthStateChanged
}

/** Sign out the current user. */
export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

/** Sign out, then immediately create a fresh anonymous session. */
export async function signOutToAnonymous() {
  await signOut(auth);
  await setPersistence(auth, browserLocalPersistence);
  const cred = await signInAnonymously(auth);
  return cred.user; // _status updates via onAuthStateChanged
}
