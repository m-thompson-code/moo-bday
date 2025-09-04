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
] as const;

// ---------- Schema (style: classic | spicy | cow) ----------
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

// ---------- Units: per-day / per-week only; allow simple money ----------
function pickUnit() {
  const units = [
    "times per week",
    "hours per week",
    "miles per week",
    "visits per week",
    "dollars per week",
    "minutes per day",
    "hours per day",
    "dollars per day",
  ];
  return units[Math.floor(Math.random() * units.length)];
}

// ---------- Style decision (cow takes precedence over spicy cadence) ----------
let styleCounter = 0;
type Style = "classic" | "spicy" | "cow";
function decideStyle(): Style {
  styleCounter += 1;
  const cowHit = Math.random() < 0.10;     // 10% chance each call
  if (cowHit) return "cow";
  const spicyHit = styleCounter % 5 === 0; // 5th, 10th, ...
  return spicyHit ? "spicy" : "classic";
}

// ---------- Minimal domain detection (fallback) ----------
const DOMAIN_REGEX: Record<string, RegExp> = {
  kingman_local: /\b(kingman|mohave\s+county|route\s*66|hualapai|colorado\s*river|arizona(?:\s+desert)?)\b/i,
  fantasy: /\b(fantasy(?!\s+football)|dragons?|wizards?|witch(?:es)?|magic|sorcer(?:y|er|ess)|orcs?|elves?|hobbits?|middle[-\s]?earth|westeros|d&d|dungeons\s*&\s*dragons)\b/i,
  extreme_situations: /\b(apocalypse|post-?apocalyptic|zombies?|aliens?|ufo(s)?|evacuation|emergenc(y|ies)|blackout|power\s*outage|earthquakes?|tornadoes?|hurricanes?|floods?|wildfires?|desert\s*island|stranded|survival|preppers?|doomsday|end\s*of\s*the\s*world)\b/i,
  dreams: /\b(dreams?|nightmares?|lucid\s*dream(?:ing)?|dream\s*journal|dream\s*recall)\b/i,
  social_media: /\b(social\s*media|scroll(ing)?|doomscroll(ing)?|tiktok|instagram|youtube|facebook|twitter|x\b)\b/i,
  nineties_kid: /\b(90s|’90s|nineties|1990s|blockbuster|aol|dial-?up|napster|limewire|walkman|game\s*boy|tamagotchi|pogs?|furby|nickelodeon|mtv|spice\s*girls|backstreet\s*boys|nsync|vhs|cassette)\b/i,
  back_in_the_day: /\b(back\s+in\s+the\s+day|remember\s+when)\b/i,
  alcohol: /\b(beer|wine|cocktail|shots?|drinks?|bar|brewery|happy\s*hour)\b/i,
  videogames: /\b(video\s*game(s)?|gaming|console(s)?|playstation|xbox|nintendo|switch|steam|pc\s*gaming|controller(s)?)\b/i,
  beauty_routines: /\b(skincare|skin\s*care|make-?up|makeup|hair\s*(care)?|groom(ing)?|shave|beard|moisturizer|serum|facial|barber|salon|mani(?:-|\s*)pedi|manicure|pedicure|nails?|lipstick|foundation|concealer|eyeliner|mascara)\b/i,
  cooking: /\b(cook(ing)?|meal\s*prep|recipe(s)?|grill(ing)?|barbecue|bbq|bake|baking|oven|air\s*fryer|slow\s*cooker|cast\s*iron|spice(s)?|season(ing)?|ingredients?)\b/i,

  movies_shows: /\b(movie|movies|film|cinema|tv|series|episode|stream(ing)?)\b/i,
  music: /\b(music|song|album|concert|playlist)\b/i,
  food_drink: /\b(eat|meal|restaurant|snack|coffee|tea)\b/i,
  fitness_sleep: /\b(exercise|workout|run|running|walk|walking|yoga|steps?|sleep)\b/i,
  tech_media: /\b(screen\s*time|phone|smartphone|podcast|news)\b/i,
  socializing: /\b(friend|friends|party|gathering|hang(out|ing)|date|dating)\b/i,
  hobbies_games: /\b(hobby|craft|board\s*game|reading|books?)\b/i,
  outdoors_travel: /\b(hiking|trail|park|lake|desert|outdoor|road\s*trip|travel|commut(e|ing))\b/i,
  pets_home: /\b(pet|dog|cat|vet|clean|laundry|dishes|chores?)\b/i,
  fashion_pop: /\b(fashion|style|trend|celebrity|gossip)\b/i,
};

const DOMAIN_LABEL: Record<string, string> = {
  kingman_local: "Kingman & local",
  fantasy: "fantasy",
  extreme_situations: "extreme situations",
  dreams: "dreams",
  social_media: "social media",
  nineties_kid: "’90s kid vibes",
  back_in_the_day: "back in the day",
  alcohol: "alcohol & going out",
  videogames: "video games",
  beauty_routines: "beauty & grooming",
  cooking: "cooking",
  movies_shows: "movies & shows",
  music: "music",
  food_drink: "food & drink",
  fitness_sleep: "fitness & sleep",
  tech_media: "tech & media",
  socializing: "social life & dating",
  hobbies_games: "hobbies & board games",
  outdoors_travel: "outdoors & travel",
  pets_home: "pets & home",
  fashion_pop: "fashion & pop buzz",
};

function detectDomain(q: string): string {
  const order = [
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
  ] as const;
  for (const key of order) if (DOMAIN_REGEX[key].test(q)) return key;
  return "other";
}

// Remember only the previous round’s domains (for one-round avoidance)
let lastDomains: Set<string> = new Set();
function buildAvoidLineFrom(set: Set<string>) {
  const avoid = [...set].filter((d) => d !== "other").map((d) => DOMAIN_LABEL[d] ?? d);
  return avoid.length ? `Avoid repeating these general domains this round: ${avoid.join(", ")}.` : "";
}

// ---------- Prompt builder ----------
function makePrompt(opts: {
  unit: string;
  style: Style;
  primaryTopic?: string;    // if set, BOTH questions must be about this
  secondaryNudge?: string;  // if primaryTopic exists, weave this into exactly one Q
  avoidLine?: string;
  seed: number;
  customPrompt?: string;
}) {
  const { unit, style, primaryTopic, secondaryNudge, avoidLine, seed, customPrompt } = opts;

  const isSpicy = style === "spicy";
  const isCow = style === "cow";

  const domainList = DOMAINS.join(", ");

  const topicBlock = primaryTopic
    ? `
Topic requirement (apply without mentioning any meta/instructions):
- BOTH questions MUST be clearly about: ${primaryTopic}.
- Use two different angles/facets so the wording isn't repetitive.
${secondaryNudge ? `- Weave "${secondaryNudge}" naturally into exactly ONE of the two questions (no quotes, no meta).` : ""}
- Keep the SAME unit for both (${unit}) and ensure the answers are on similar scales so they could be confused.
- Write naturally; do NOT use the words "topic", "rule", or "instruction".`
    : `
- Use DIFFERENT topics (e.g., one about shows/movies, the other about everyday habits/pop topics).
- Keep the SAME unit for both (${unit}) and make the answers similar in scale so they could be confused.
${avoidLine ? `- ${avoidLine}` : ""}`;

  const styleBlock = isSpicy
    ? `
Adult party mode (clearly adult, playful, not explicit):
- EACH question MUST center on at least ONE adult theme: dating, flirting, romance, attraction, intimacy, nightlife, DM/flirty messaging, “thirst” scrolling, kissing/makeouts, spicy scenes in media, or late-night texting.
- Keep it cheeky and consent-focused; innuendo is fine.
- Do NOT include explicit sexual acts or graphic anatomical terms; no minors.
- Do NOT default to neutral topics (e.g., coffee amounts, generic TV counts) when style is spicy.`
    : `
Party mode:
- Fun, relaxed, and social — the kind of thing friends in their 30s–40s would answer over drinks.`;

  const cowLine = isCow ? "- Theme this round is cows — keep both questions cow-related." : "";

  const base =
    customPrompt ??
    `Create 2 short, distinct, easy-to-answer questions with numeric answers.

Calibration context (do NOT mention this in the questions):
- Audience: adults in their 30s–40s in 2025 (Kingman, AZ vibe; not very online). Use this ONLY to set reasonable min/max/average values and topical relevance.

Focus domains (opinions + mainstream 2025 stuff; everyday money is fine):
- Opinions of random things, everyday life patterns, movies/shows, music, social trends, things to do; everyday prices/budgets are okay (e.g., toothbrush price). Avoid finance jargon.

Requirements for the QUESTIONS (the text players see):
- Ask direct, single-clause questions.
- Use the SAME unit for both questions: (${unit}). Put ONLY the unit in parentheses at the END of each question (e.g., "(times per week)").
- Units must be per day or per week — do NOT use per month or per year.
- Keep them concise, conversational, and natural (no survey-speak).
- Vary the opening phrasing so they don't sound templated.
- Strictly avoid religion and partisan politics; pop culture is fine. Avoid divisive culture-war framing.
${cowLine}
${topicBlock}
${styleBlock}

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

// ---------- Route ----------
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const customPrompt: string | undefined = body.prompt;

    // Optional: client-provided avoid domains (e.g., from previous response)
    const clientAvoid: string[] = Array.isArray(body.avoidDomains) ? body.avoidDomains : [];

    // Sanitize suggestedTopic (optional)
    const rawTopic: string | undefined =
      typeof body.suggestedTopic === "string" ? body.suggestedTopic.trim() : undefined;
    const suggestedTopic =
      rawTopic && rawTopic.length > 0
        ? rawTopic.replace(/[\r\n]+/g, " ").replace(/["'<>]/g, "")
        : undefined;

    const unit = pickUnit();
    const style = decideStyle();
    const isCow = style === "cow";

    // Topic rules:
    // - If cow round -> primary = "cows"; suggestedTopic (if provided & not cows) is a secondary nudge in exactly one Q.
    // - Else if suggestedTopic provided -> BOTH questions must be about it (hard-nudge).
    // - Else -> no hard topic; ask for different topics.
    const primaryTopic = isCow ? "cows" : suggestedTopic || undefined;
    const secondaryNudge =
      isCow && suggestedTopic && suggestedTopic.toLowerCase() !== "cows"
        ? suggestedTopic
        : undefined;

    // Build avoid set from server memory + client-provided avoidDomains
    const avoidSet = new Set<string>([...lastDomains, ...clientAvoid]);
    const avoidLine = primaryTopic ? "" : buildAvoidLineFrom(avoidSet);

    // First try
    const seed1 = Math.floor(Math.random() * 1_000_000);
    const prompt1 = makePrompt({
      unit,
      style,
      primaryTopic,
      secondaryNudge,
      avoidLine,
      seed: seed1,
      customPrompt,
    });

    let { object } = await generateObject({
      model: openai("gpt-5-nano"),
      schema,
      prompt: prompt1,
      temperature: 0.9,
    });

    // Soft retry only if we had NO hard topic and it repeated last round's domains
    if (!primaryTopic && avoidSet.size > 0) {
      const newDomains = new Set(object.domainsUsed);
      const overlaps = [...newDomains].some((d) => avoidSet.has(d));
      if (overlaps) {
        const seed2 = Math.floor(Math.random() * 1_000_000);
        const prompt2 = makePrompt({
          unit,
          style,
          primaryTopic,
          secondaryNudge,
          avoidLine,
          seed: seed2,
          customPrompt,
        });
        ({ object } = await generateObject({
          model: openai("gpt-5-nano"),
          schema,
          prompt: prompt2,
          temperature: 0.95,
        }));
      }
    }

    // Update server memory with THIS round's domains
    lastDomains = new Set(object.domainsUsed);

    return NextResponse.json(object, { status: 200 });
  } catch (err: any) {
    console.error("get-questions route error:", err);
    return NextResponse.json({ error: "Failed to generate questions" }, { status: 500 });
  }
}
