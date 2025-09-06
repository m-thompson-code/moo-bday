// lib/useUsername.ts
import { useEffect, useState } from "react";
import { useAuthStatus } from "./useAuthStatus";
import {
  startNameStatus,
  nameStatus,
  subscribeNameStatus,
  upsertUsername,
  type NameStatus,
} from "./firebase.firestore";

/**
 * React hook to read and set the username.
 * - Mirrors the NameStatus FSM ("idle" | "has-username" | "missing-username")
 * - Exposes a `save(name)` that writes to Firestore and updates local cache + FSM
 */
export function useUsername(): {
  status: NameStatus["state"];
  username: string | null;
  save: (name: string) => Promise<void>;
} {
  const auth = useAuthStatus();
  const [ns, setNs] = useState<NameStatus>(nameStatus());

  useEffect(() => {
    startNameStatus(); // idempotent
    const unsub = subscribeNameStatus(setNs);
    return unsub;
  }, []);

  async function save(name: string) {
    if (auth.state !== "signed-in") throw new Error("Not signed in");
    await upsertUsername(auth.user.uid, name);
  }

  return {
    status: ns.state,
    username: ns.state === "has-username" ? ns.username : null,
    save,
  };
}
