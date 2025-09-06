// lib/useAuthStatus.ts
"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { User } from "firebase/auth";
import {
  subscribeAuth,
  authStatus,
  startAuth,
  type AuthStatus,
} from "./firebase.auth";
import { isAdminUser } from "./firebase.auth";

export type Role = "unknown" | "admin" | "player";

/**
 * Backward-compatible shape with extra fields:
 * - `isAdmin`: boolean
 * - `role`: "admin" | "player" | "unknown"
 * - `email`: string | null
 *
 * You'll still have:
 * - state: "idle" | "signed-in" | "signed-out"
 * - user (only when state === "signed-in")
 */
export type AuthStatusWithAdmin =
  | ({
      state: "idle";
      email: null;
      isAdmin: false;
      role: "unknown";
    } & { user?: undefined })
  | ({
      state: "signed-out";
      email: null;
      isAdmin: false;
      role: "unknown";
    } & { user?: undefined })
  | ({
      state: "signed-in";
      user: User;
      email: string | null;
      isAdmin: boolean;
      role: "admin" | "player";
    });

/**
 * React hook that subscribes to your auth store and augments it with admin info.
 * - Calls startAuth() on mount (client-side).
 * - Computes isAdmin via isAdminUser(user) (email-based).
 */
export function useAuthStatus(): AuthStatusWithAdmin {
  // Subscribe to the external auth store without tearing
  const base = useSyncExternalStore(subscribeAuth, authStatus, authStatus) as AuthStatus;

  // Ensure auth bootstraps on the client
  useEffect(() => {
    startAuth();
  }, []);

  if (base.state === "signed-in") {
    const email = base.user.email ?? null;
    const admin = isAdminUser(base.user);
    const role: Role = admin ? "admin" : "player";
    return { ...base, email, isAdmin: admin, role };
  }

  // idle or signed-out
  return {
    // keep the original discriminant
    state: base.state,
    // add our extras
    email: null,
    isAdmin: false,
    role: "unknown",
  } as AuthStatusWithAdmin;
}
