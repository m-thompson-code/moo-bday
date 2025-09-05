// app/api/get-questions/route.ts
import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

export const runtime = "nodejs";

/** Domain list (must match regex keys below) */
const DOMAINS = [
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

type Domain = typeof DOMAINS[number];
type Style = "classic" | "spicy" | "cow";

/** Schema (client-driven, stateless) */
const DomainEnum = z.enum(DOMAINS);
const schema = z.object({
  style: z.enum(["classic", "spicy", "cow"]),
  domainsUsed: z.array(DomainEnum).length(2),
  questions: z
    .array(
      z.object({
        question: z.string(),
        average: z.number(),
        min: z.number(),
        max: z.number(),
        domain: DomainEnum,
      })
    )
    .length(2),
});

/** Allowed units (client picks one) */
const ALLOWED_UNITS = [
  "times in your life",
  "in a single day",
  "in a single week",
  "dollars per day",
  "next year",
] as const;
type Unit = typeof ALLOWED_UNITS[number];

function sanitizeText(s?: unknown) {
  if (typeof s !== "string") return undefined;
  const trimmed = s.trim();
  return trimmed.length ? trimmed.replace(/[\r\n]+/g, " ").replace(/["'<>]/g, "") : undefined;
}

function buildAvoidLine(avoidDomains: Domain[]) {
  return avoidDomains.length
    ? `Avoid repeating these general domains this round: ${avoidDomains.join(", ")}.`
    : "";
}

function makePrompt(opts: {
  style: Style;
  unit: Unit;
  primaryTopic?: string;
  secondaryNudge?: string;
  avoidDomains: Domain[];
  seed: number;
  customPrompt?: string;
}) {
  const { style, unit, primaryTopic, secondaryNudge, avoidDomains, seed, customPrompt } = opts;
  const isSpicy = style === "spicy";
  const isCow = style === "cow";
  const domainList = DOMAINS.join(", ");
  const avoidLine = buildAvoidLine(avoidDomains);

  const topicBlock = primaryTopic
    ? `
Topic requirement (apply without mentioning any meta/instructions):
- BOTH questions MUST be clearly about: ${primaryTopic}.
- Use two different angles/facets so the wording isn't repetitive.
${secondaryNudge ? `- Weave "${secondaryNudge}" naturally into exactly ONE of the two questions (no quotes, no meta).` : ""}
- Keep the SAME unit for both ("${unit}").
- Ensure both questions naturally land on comparable magnitudes so answers could be confused.
- Write naturally; do NOT use the words "topic", "rule", or "instruction".`
    : `
- Use DIFFERENT topics (e.g., one about shows/movies, the other about everyday habits/pop topics).
- Keep the SAME unit for both ("${unit}").
- Ensure both questions naturally land on comparable magnitudes so answers could be confused.
${avoidLine ? `- ${avoidLine}` : ""}`;

  const styleBlock = isSpicy
    ? `
Adult party mode (clearly adult, playful, not explicit):
- EACH question MUST center on at least ONE adult theme: dating, flirting, romance, attraction, intimacy, nightlife, DM/flirty messaging, “thirst” scrolling, kissing/makeouts, spicy scenes in media, late-night texting, **risk-taking/dares**, or **light rule-bending**.
- Truth-or-dare vibe encouraged: include **embarrassing-but-fun admissions** (e.g., awkward flirt fails, sending a risky text, cheeky dares) that yield a number with "${unit}".
- You MAY include mischievous or semi-illicit vibes (e.g., sneaking into a second movie, skinny-dipping, crashing a party) but keep it non-graphic, non-instructional, and non-harmful.
- Do NOT encourage or describe dangerous or clearly illegal acts (no DUI, drugs, weapons, theft, breaking/entering, property damage). No instructions or how-tos. Do not involve minors.
- Keep it cheeky and consent-focused; avoid explicit sexual acts or graphic anatomy.`
    : `
Party mode:
- Fun, relaxed, and social — the kind of thing friends in their 30s–40s would answer over drinks.
- Truth-or-dare vibe welcome: allow **lightly embarrassing admissions** (e.g., guilty pleasures, cringey habits, celebrity crush moments, shower singing) that still produce a number with "${unit}".
- Keep questions safe, non-graphic, and do not require confessions to crimes or dangerous behaviors.`;

  const cowLine = isCow ? "- Theme this round is cows — keep both questions cow-related." : "";

  const base =
    customPrompt ??
    `Create 2 short, distinct, easy-to-answer questions with numeric answers.

Calibration context (do NOT mention this in the questions):
- Audience: adults in their 30s–40s (Kingman, AZ vibe; not very online). Use this ONLY to set reasonable min/max/average values and topical relevance.

Focus areas (opinions + mainstream stuff; everyday money is fine):
- Opinions of random things, everyday life patterns, movies/shows, music, social trends, things to do; everyday prices/budgets are okay (e.g., toothbrush price). Avoid finance jargon.

Requirements for the QUESTIONS (the text players see):
- Ask direct, single-clause questions.
- Use the SAME unit for both questions, and **embed the exact phrase "${unit}" naturally in each question's wording** (no parentheses or brackets).
- Keep them concise, conversational, and natural (no survey-speak).
- Vary the opening phrasing so they don't sound templated.
- Strictly avoid religion and partisan politics; pop culture is fine. Avoid divisive culture-war framing.
${cowLine}
${topicBlock}
${styleBlock}

Numeric outputs for JSON (do NOT mention numbers in the question text):
- Set "average" values for BOTH questions to be **close** (similar magnitude; aim within about 20% of each other), not necessarily identical.
- "min" and "max" may DIFFER between the two questions; choose plausible ranges around each question's average.

Domain labeling (for the return JSON):
- For EACH question, choose ONE best-fit domain from this exact list and add it as "domain": [${domainList}].
- Also return a top-level "domainsUsed" array listing the two domains in order of the questions.

Strictly DO NOT include in the question text:
- Any age ranges or the words "adult(s)", "typical", "on average", "average", "median", "min", "max".
- Any direct location framing like "in Kingman", "here in our town", "where you live".
- Any meta language like "unit", "scale", "per the rules", references to instructions, or the seed.

Return JSON with this exact shape:
{
  "style": "${style}",                 // "classic" | "spicy" | "cow"
  "domainsUsed": [Domain, Domain],     // from the list above, in Q1,Q2 order
  "questions": [
    { "question": string, "min": number, "max": number, "average": number, "domain": Domain },
    { "question": string, "min": number, "max": number, "average": number, "domain": Domain }
  ]
}`;

  return `${base}

Seed: ${seed}
Return strictly in the required JSON schema; do not add commentary.`.trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // Client-driven inputs (stateless)
    const style: Style =
      ["classic", "spicy", "cow"].includes(body.style) ? body.style : "classic";

    const unit: Unit = (ALLOWED_UNITS as readonly string[]).includes(body.unit)
      ? body.unit
      : (ALLOWED_UNITS[Math.floor(Math.random() * ALLOWED_UNITS.length)] as Unit);

    const primaryTopic = sanitizeText(body.primaryTopic) ??
      (style === "cow" ? "cows" : undefined);
    const secondaryNudge = sanitizeText(body.secondaryNudge);

    const avoidDomains: Domain[] = Array.isArray(body.avoidDomains)
      ? (body.avoidDomains.filter((d: any) =>
          typeof d === "string" && (DOMAINS as readonly string[]).includes(d)
        ) as Domain[])
      : [];

    const seed = Number.isFinite(body.seed) ? Number(body.seed) : Math.floor(Math.random() * 1_000_000);
    const customPrompt = sanitizeText(body.prompt);

    const prompt = makePrompt({
      style,
      unit,
      primaryTopic,
      secondaryNudge,
      avoidDomains,
      seed,
      customPrompt,
    });

    const { object } = await generateObject({
      model: openai("gpt-5-nano"),
      schema,
      prompt,
      temperature: typeof body.temperature === "number" ? body.temperature : 0.9,
    });

    return NextResponse.json(object, { status: 200 });
  } catch (err: any) {
    console.error("get-questions error:", err);
    return NextResponse.json({ error: "Failed to generate questions" }, { status: 500 });
  }
}
