// app/play/page.tsx
"use client";

import { useState } from "react";
import {
  nextQuestions,
  getLastQuestions,
  resetQuestionsMemory,
  type QuestionsResponse,
} from "@/libs/partyQuestionsClient";

export default function PlayPage() {
  const [topic, setTopic] = useState("");
  const [resp, setResp] = useState<QuestionsResponse | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleGet() {
    try {
      setLoading(true);
      setError(undefined);
      const data = await nextQuestions(topic || undefined); // utilities own unit/style/seed/avoidDomains
      setResp(data);
    } catch (e: any) {
      setError(e?.message || "Failed to get questions");
    } finally {
      setLoading(false);
    }
  }

  function handleLoadLast() {
    try {
      setError(undefined);
      const last = getLastQuestions(); // reads localStorage ONLY on click
      if (!last) {
        setError("No saved round yet — fetch a new set first.");
        return;
      }
      setResp(last);
    } catch {
      setError("Couldn't load the last round.");
    }
  }

  function handleReset() {
    resetQuestionsMemory();
    setResp(undefined);
    setError(undefined);
  }

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Party Questions</h1>

      <div className="grid grid-cols-1 gap-3">
        <label className="flex items-center gap-2">
          <span className="w-44">Suggested topic (optional)</span>
          <input
            className="border rounded px-2 py-1 flex-1"
            placeholder='e.g., "dating apps", "barbecues", "nostalgia"'
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            className="bg-black text-white rounded px-3 py-2 disabled:opacity-60"
            onClick={handleGet}
            disabled={loading}
          >
            {loading ? "Loading..." : "Get questions"}
          </button>
          <button className="border rounded px-3 py-2" onClick={handleLoadLast}>
            Load last
          </button>
          <button className="border rounded px-3 py-2" onClick={handleReset}>
            Reset memory
          </button>
        </div>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      {resp && (
        <section className="mt-4 space-y-3">
          <div className="text-sm text-gray-600">
            Style: <b>{resp.style}</b> • Domains: <b>{resp.domainsUsed.join(", ")}</b>
          </div>
          {resp.questions.map((q, i) => (
            <div key={i} className="border rounded p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">
                Domain: {q.domain}
              </div>
              <div className="text-lg">{q.question}</div>
              <div className="text-sm text-gray-700">
                Range: {q.min}-{q.max} • Avg: {q.average}
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
