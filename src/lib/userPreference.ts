/**
 * User Preference / Investing Style Memory
 *
 * After every CEO response, Claude Haiku extracts signals about the user's
 * investing style from the conversation. These accumulate over time and are
 * injected into the CEO system prompt so report sections are reordered to
 * match what the user actually cares about.
 */

import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/firebase-admin";

export interface InvestingStyle {
  horizon:       "short_term" | "medium_term" | "long_term" | "unknown";
  riskTolerance: "conservative" | "moderate" | "aggressive" | "unknown";
  style:         "value" | "growth" | "momentum" | "income" | "mixed" | "unknown";
  sectors:       string[];
  priorities:    string[];  // ordered list of what user cares about most
  confidence:    number;    // 0-1, how confident we are in this profile
}

const DEFAULT_STYLE: InvestingStyle = {
  horizon:       "unknown",
  riskTolerance: "unknown",
  style:         "unknown",
  sectors:       [],
  priorities:    [],
  confidence:    0,
};

// How the CEO should reorder report sections per style
export const STYLE_SECTION_ORDER: Record<string, string[]> = {
  value:    ["Graham Screen", "DCF Valuation", "Comparables", "Multi-Year Fundamentals", "Insider & Institutional", "Analyst Consensus", "Risk Analysis", "Technical Analysis", "News Research", "Social Sentiment"],
  growth:   ["Multi-Year Fundamentals", "Earnings & Catalysts", "Analyst Consensus", "DCF Valuation", "Technical Analysis", "Comparables", "Risk Analysis", "News Research", "Social Sentiment", "Insider & Institutional"],
  momentum: ["Technical Analysis", "Social Sentiment", "Options Flow", "News Research", "Earnings & Catalysts", "Analyst Consensus", "Risk Analysis", "Macro & Market", "Multi-Year Fundamentals", "DCF Valuation"],
  income:   ["Multi-Year Fundamentals", "DCF Valuation", "Risk Analysis", "Analyst Consensus", "Graham Screen", "Comparables", "Earnings & Catalysts", "Insider & Institutional", "Technical Analysis", "Macro & Market"],
};

export async function getUserPreference(userId: string): Promise<InvestingStyle> {
  try {
    const snap = await db.collection("users").doc(userId).collection("preferences").doc("style").get();
    if (!snap.exists) return DEFAULT_STYLE;
    const data = snap.data()!;
    if (!data.style) return DEFAULT_STYLE;
    return JSON.parse(data.style) as InvestingStyle;
  } catch {
    return DEFAULT_STYLE;
  }
}

export async function saveUserPreference(userId: string, style: InvestingStyle): Promise<void> {
  try {
    await db.collection("users").doc(userId).collection("preferences").doc("style").set({
      style: JSON.stringify(style),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[userPreference] save error:", err);
  }
}

/**
 * Extract investing style signals from a conversation turn.
 * Uses Haiku for speed. Merges with existing profile — confidence accumulates.
 * Fire-and-forget safe.
 */
export async function updateStyleFromConversation(
  userId: string,
  userQuery: string,
  assistantResponse: string,
  anthropicClient: Anthropic
): Promise<void> {
  try {
    const existing = await getUserPreference(userId);

    const res = await anthropicClient.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `Analyze this investing research conversation and infer the user's investing style.

User asked: "${userQuery.slice(0, 300)}"
Assistant covered: "${assistantResponse.slice(0, 400)}"

Existing profile (may be partial): ${JSON.stringify(existing)}

Return ONLY a JSON object with this exact shape (no markdown, no explanation):
{
  "horizon": "short_term" | "medium_term" | "long_term" | "unknown",
  "riskTolerance": "conservative" | "moderate" | "aggressive" | "unknown",
  "style": "value" | "growth" | "momentum" | "income" | "mixed" | "unknown",
  "sectors": ["tech", "healthcare", ...] or [],
  "priorities": ["technicals", "valuation", "sentiment", ...] or [],
  "confidence": 0.0-1.0
}

Rules:
- Asking about RSI/MACD/momentum → momentum style
- Asking about DCF/Graham/P/E → value style
- Asking about revenue growth/TAM → growth style
- Asking about dividends/yield → income style
- Short hold mentions → short_term; "long-term" mentions → long_term
- High leverage/options interest → aggressive risk
- Focus on risk/hedging → conservative
- Only set fields you are CONFIDENT about; keep "unknown" otherwise
- Increase confidence by 0.1-0.2 per turn, cap at 0.95
- Merge with existing: if existing says "value" and new evidence is "value", keep "value"; if conflicting, prefer "mixed"`,
      }],
    });

    const text = res.content.find((b) => b.type === "text")?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return;

    const extracted = JSON.parse(match[0]) as InvestingStyle;

    // Merge: keep existing values where new is "unknown", increase confidence
    const merged: InvestingStyle = {
      horizon:       extracted.horizon       !== "unknown" ? extracted.horizon       : existing.horizon,
      riskTolerance: extracted.riskTolerance !== "unknown" ? extracted.riskTolerance : existing.riskTolerance,
      style:         extracted.style         !== "unknown" ? extracted.style         : existing.style,
      sectors:       extracted.sectors.length > 0
        ? [...new Set([...existing.sectors, ...extracted.sectors])].slice(0, 6)
        : existing.sectors,
      priorities:    extracted.priorities.length > 0 ? extracted.priorities : existing.priorities,
      confidence:    Math.min(0.95, Math.max(existing.confidence, extracted.confidence)),
    };

    await saveUserPreference(userId, merged);
  } catch (err) {
    console.error("[userPreference] update error:", err);
  }
}

/**
 * Build a style block for injection into the CEO system prompt.
 * Only injected once confidence > 0.3 to avoid noisy early guesses.
 */
export function buildStylePrompt(style: InvestingStyle): string {
  if (style.confidence < 0.3 || style.style === "unknown") return "";

  const sectionOrder = STYLE_SECTION_ORDER[style.style];
  const orderHint = sectionOrder
    ? `Present your findings in this order to match their focus: ${sectionOrder.slice(0, 6).join(" → ")}.`
    : "";

  const parts: string[] = [
    `## User Investing Profile (confidence: ${(style.confidence * 100).toFixed(0)}%)`,
    `- **Style**: ${style.style}`,
    style.horizon       !== "unknown" ? `- **Horizon**: ${style.horizon.replace("_", "-")}` : "",
    style.riskTolerance !== "unknown" ? `- **Risk tolerance**: ${style.riskTolerance}` : "",
    style.sectors.length       > 0    ? `- **Preferred sectors**: ${style.sectors.join(", ")}` : "",
    style.priorities.length    > 0    ? `- **Priorities**: ${style.priorities.join(", ")}` : "",
    orderHint,
    "Tailor the depth and emphasis of your report to match this profile.",
  ].filter(Boolean);

  return parts.join("\n");
}
