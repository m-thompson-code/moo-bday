"use client";

export type Style = "classic" | "spicy" | "cow";

export const DOMAINS = [
  "kingman_local",
  "fantasy",
  "extreme_situations",
  "dreams",
  "social_media",
  "nineties_kid",
  "back_in_the_day",
  "alcohol",
  "videogames",
  "beauty_routines",
  "cooking",
  "movies_shows",
  "music",
  "food_drink",
  "fitness_sleep",
  "tech_media",
  "socializing",
  "hobbies_games",
  "outdoors_travel",
  "pets_home",
  "fashion_pop",
  "personal_time",
  "habits",
  "work",
  "hypothetical_scenario",
  "in_a_perfect_world",
  "recent_release_media",
] as const;
export type Domain = typeof DOMAINS[number];

type Unit =
  | "times in your life"
  | "in a single day"
  | "in a single week"
  | "dollars per day"
  | "next year";

export interface Question {
  question: string;
  min: number;
  max: number;
  average: number;
  domain: Domain;
  style: Style;
}
export interface QuestionsResponse {
  style: Style;
  domainsUsed: [Domain, Domain];
  questions: [Question, Question];
}

// ---- local storage keys
const LS_KEY_LAST = "pq:last";
const LS_KEY_COUNTER = "pq:styleCounter";

// ---- internals
function rngUint32(): number {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0]!;
  }
  return Math.floor(Math.random() * 0xffffffff);
}

function sanitize(s?: string | null): string | undefined {
  if (!s) return undefined;
  const t = s.trim();
  if (!t) return undefined;
  return t.replace(/[\r\n]+/g, " ").replace(/["'<>]/g, "");
}

function nextStyleCounter(): number {
  const n = Number(localStorage.getItem(LS_KEY_COUNTER) ?? "0") || 0;
  const next = n + 1;
  localStorage.setItem(LS_KEY_COUNTER, String(next));
  return next;
}

function decideStyle(): Style {
  // ~10% chance cow (overrides)
  const cowHit = rngUint32() % 10 === 0;
  if (cowHit) return "cow";
  // every 5th spicy
  const count = nextStyleCounter();
  return count % 5 === 0 ? "spicy" : "classic";
}

function chooseUnit(): Unit {
  // bias toward day/week
  const weighted: Unit[] = [
    "in a single day",
    "in a single day",
    "in a single week",
    "in a single week",
    "dollars per day",
    "times in your life",
    "next year",
  ];
  return weighted[rngUint32() % weighted.length];
}

function loadLast(): QuestionsResponse | undefined {
  try {
    const raw = localStorage.getItem(LS_KEY_LAST);
    if (!raw) return undefined;
    return JSON.parse(raw) as QuestionsResponse;
  } catch {
    return undefined;
  }
}

function saveLast(resp: QuestionsResponse) {
  localStorage.setItem(LS_KEY_LAST, JSON.stringify(resp));
}

async function requestQuestions(payload: {
  style: Style;
  unit: Unit;
  primaryTopic?: string;
  secondaryNudge?: string;
  avoidDomains: Domain[];
  seed: number;
  temperature?: number;
}): Promise<QuestionsResponse> {
  // fixed endpoint; no override
  const res = await fetch("/api/get-questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? `Request failed with ${res.status}`);
  }

  const resp = (await res.json()) as QuestionsResponse;

  return { ...resp, questions: resp.questions.map(q => ({ ...q, style: payload.style })) as [Question, Question] }; // ensure style matches request
}

// ---- public helpers

/** Clear client-side memory of previous round (domains avoidance). */
export function resetQuestionsMemory() {
  localStorage.removeItem(LS_KEY_LAST);
}

/**
 * Get next pair of questions.
 * The ONLY thing you can optionally pass is a user-suggested topic.
 */
export async function nextQuestions(userSuggestedTopic?: string): Promise<QuestionsResponse> {
  const style = decideStyle();
  const unit = chooseUnit();

  // avoid domains based on last response
  const last = loadLast();
  const avoidDomains = (last?.domainsUsed ?? []).filter((d): d is Domain =>
    (DOMAINS as readonly string[]).includes(d)
  ) as Domain[];

  // topics (let the server apply cow rules; we only send secondary when cow+topic)
  const userTopic = sanitize(userSuggestedTopic);
  const primaryTopic = style === "cow" ? undefined : userTopic; // server defaults cow -> "cows"
  const secondaryNudge = userTopic;
    // style === "cow" && userTopic && userTopic.toLowerCase() !== "cows" ? userTopic : undefined;

  const payload = {
    style,
    unit,
    primaryTopic,
    secondaryNudge,
    avoidDomains,
    seed: rngUint32(),
    temperature: 0.9,
  };

  const resp = await requestQuestions(payload);
  saveLast(resp);
  return resp;
}

/** Optional read-only accessor if you want to show the last questions somewhere. */
export function getLastQuestions(): QuestionsResponse | undefined {
  return loadLast();
}
