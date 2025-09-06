// pages/_app.tsx
import type { AppProps } from "next/app";
import { useEffect } from "react";
import { startAuth } from "@/lib/firebase.auth";
import "@/app/globals.css";

export default function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Fire-and-forget: create the single Firebase auth subscription
    startAuth();
  }, []);

  return <Component {...pageProps} />;
}
