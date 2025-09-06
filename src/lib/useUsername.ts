// lib/useUsername.ts
"use client";

import { useEffect, useState } from "react";
import { useAuthStatus } from "./useAuthStatus";
import { fetchUsername, setUsername } from "./firebase.firestore";

export type UsernameStatus = "idle" | "has-username" | "missing-username";

/**
 * React hook to read and set the username.
 * - Derives state from auth + Firestore:
 *   "idle" | "has-username" | "missing-username"
 * - save(name) writes to Firestore and updates local state
 */
export function useUsername(): {
  status: UsernameStatus;
  username: string | null;
  save: (name: string) => Promise<void>;
} {
  const auth = useAuthStatus();
  const [status, setStatus] = useState<UsernameStatus>("idle");
  const [username, setLocalUsername] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (auth.state !== "signed-in") {
        if (!alive) return;
        setStatus("idle");
        setLocalUsername(null);
        return;
      }

      const name = await fetchUsername(auth.user.uid);
      if (!alive) return;

      if (name && name.trim()) {
        setStatus("has-username");
        setLocalUsername(name.trim());
      } else {
        setStatus("missing-username");
        setLocalUsername(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [auth.state, auth.state === "signed-in" ? auth.user.uid : ""]);

  async function save(name: string) {
    if (auth.state !== "signed-in") throw new Error("Not signed in");
    const clean = name.trim();
    await setUsername(auth.user.uid, clean);
    setLocalUsername(clean);
    setStatus("has-username");
  }

  return {
    status,
    username,
    save,
  };
}
