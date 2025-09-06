// lib/useSession.ts
"use client";

import { useEffect, useState } from "react";
import { listenSession, type SessionDoc } from "./firebase.firestore";
import { useAuthStatus } from "./useAuthStatus";

export type SessionWithSpy = (SessionDoc & { isSpy: boolean }) | null;

/**
 * Subscribes to the single session doc.
 * Returns `null` until the first snapshot arrives (treat as loading).
 * Adds `isSpy` = currentUser.uid === session.spy (false if not signed in or spy unset).
 */
export function useSession(): SessionWithSpy {
  const [val, setVal] = useState<SessionDoc | null>(null);
  const status = useAuthStatus();

  useEffect(() => {
    const off = listenSession((s) => setVal(s));
    return () => off();
  }, []);

  const isSpy =
    status.state === "signed-in" &&
    !!val &&
    typeof val.spy === "string" &&
    val.spy === status.user.uid;

  return val ? ({ ...val, isSpy } as SessionDoc & { isSpy: boolean }) : null;
}
