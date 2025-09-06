// pages/index.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuthStatus } from "@/lib/useAuthStatus";
import { fetchUsername } from "@/lib/firebase.firestore";

export default function HomePage() {
  const router = useRouter();
  const status = useAuthStatus();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let on = true;

    (async () => {
      if (status.state === "idle") {
        // waiting for _app.tsx bootstrap
        return;
      }
      if (status.state === "signed-out") {
        // very rare for anon flow; just show loader
        setChecking(false);
        return;
      }
      if (status.state === "signed-in") {
        const name = await fetchUsername(status.user.uid);
        if (!on) return;

        if (name) {
          router.replace("/welcome"); // has username → go to welcome
        } else {
          router.replace("/username"); // no username yet → go set it
        }
      }
      setChecking(false);
    })();

    return () => {
      on = false;
    };
  }, [status, router]);

  // Simple skeleton while we decide where to send them
  return (
    <main style={{ maxWidth: 480, margin: "8px auto", padding: "8px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Welcome</h1>
      <p>Preparing your session…</p>
    </main>
  );
}
