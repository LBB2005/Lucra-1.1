import { anthropic, MODEL } from "@/lib/anthropic";
import { agentTools } from "./tools/index";
import { runRiskAgent } from "./sub-agents/risk-agent";
import { runNewsAgent } from "./sub-agents/news-agent";
import { runMacroAgent } from "./sub-agents/macro-agent";
import { runTechnicalAgent } from "./sub-agents/technical-agent";
import { runDcfAgent } from "./sub-agents/dcf-agent";
import { runEarningsAgent } from "./sub-agents/earnings-agent";
import { runInsiderAgent } from "./sub-agents/insider-agent";
import { runSentimentAgent } from "./sub-agents/sentiment-agent";
import { runCompetitorAgent } from "./sub-agents/competitor-agent";
import { runOptionsAgent } from "./sub-agents/options-agent";
import { runComparablesAgent } from "./sub-agents/comparables-agent";
import { runGrahamAgent } from "./sub-agents/graham-agent";
import { runAnalystAgent } from "./sub-agents/analyst-agent";
import type { AgentEvent, AgentName } from "@/types/chat";
import type { MessageParam, ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages";

type EventEmitter = (event: AgentEvent) => void;

// Deep agents run complex multi-step analysis — no timeout cap
const DEEP_AGENTS = new Set(["run_dcf_agent", "run_insider_agent", "run_earnings_agent", "run_competitor_agent", "run_graham_agent"]);
const STANDARD_TIMEOUT_MS = 60_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

const agentDispatch: Record<string, (input: unknown) => Promise<string>> = {
  run_risk_agent: runRiskAgent,
  run_news_agent: runNewsAgent,
  run_macro_agent: runMacroAgent,
  run_technical_agent: runTechnicalAgent,
  run_dcf_agent: runDcfAgent,
  run_earnings_agent: runEarningsAgent,
  run_insider_agent: runInsiderAgent,
  run_sentiment_agent: runSentimentAgent,
  run_competitor_agent: runCompetitorAgent,
  run_options_agent: runOptionsAgent,
  run_comparables_agent: runComparablesAgent,
  run_graham_agent: runGrahamAgent,
  run_analyst_agent: runAnalystAgent,
};

const SKEPTIC_MODEL = "claude-haiku-4-5-20251001";

export async function runCeoAgent(
  userPrompt: string,
  portfolioContext: string,
  emit: EventEmitter
) {
  const systemPrompt = `You are Lucra's CEO Research Agent — an expert AI financial analyst managing a team of specialized sub-agents. Your job is to:
1. Understand what the user wants
2. Deploy the right sub-agents to gather comprehensive data
3. Synthesize their findings into clear, actionable investment insights

${portfolioContext ? `## User's Portfolio\n${portfolioContext}` : "The user has no portfolio holdings yet."}

## Your Sub-Agent Team
- **Risk Agent**: Portfolio concentration, beta, volatility analysis
- **News Agent**: Recent news and sentiment for specific tickers
- **Macro Agent**: Market-wide and sector trends (SPY, QQQ, sector ETFs)
- **Technical Agent**: RSI, MACD, moving averages
- **DCF Agent**: Discounted cash flow valuation and fair value
- **Earnings Agent**: Earnings history, EPS trends, upcoming catalysts
- **Insider Agent**: SEC Form 4 insider trading, 13F institutional changes
- **Sentiment Agent**: Social media sentiment (StockTwits, Reddit)
- **Competitor Agent**: Peer comparison and competitive positioning
- **Options Agent**: Options flow, put/call ratio, unusual activity
- **Comparables Agent**: P/E, EV/EBITDA, P/S, P/B, FCF Yield vs peers
- **Graham Screen Agent**: Benjamin Graham defensive value criteria scorecard
- **Analyst Consensus Agent**: Wall Street price targets and buy/hold/sell ratings

## Instructions
- Be decisive: deploy multiple agents when the question requires comprehensive analysis
- **Prefer parallel tool calls**: when multiple agents are needed, call them in the same message so they run simultaneously
- Don't call the same agent twice for the same data
- After all agents complete, do a **final compilation pass**: cross-reference findings, flag any contradictions, and produce a polished, well-structured report
- Always provide specific, actionable recommendations backed by the data
- End with a clear "Summary & Recommendation" section
- Note this is not financial advice

## Chart Output Format
When your response includes comparative data, performance figures, or time series — embed an interactive chart using a fenced \`\`\`chart code block. The chart JSON schema:

\`\`\`
{
  "type": "bar" | "line" | "area" | "donut",
  "title": "Chart title",
  "description": "optional subtitle",
  "unit": "%" | "$" | "" ,
  "data": [{ "name": "LABEL", "value": 123.4 }, ...],
  "series": [{ "key": "fieldName", "label": "Display", "color": "#hex" }]  // only for multi-series line/area/bar
}
\`\`\`

Use charts liberally:
- P&L comparison across holdings → bar chart, unit "%"
- Portfolio allocation → donut chart
- Price or valuation trends over time → line or area chart
- Peer comparison (P/E, margins) → bar chart
- Always set a descriptive title and unit`;

  const messages: MessageParam[] = [{ role: "user", content: userPrompt }];

  let iteration = 0;
  const MAX_ITERATIONS = 10;
  // Accumulate sub-agent outputs for the skeptic pass
  const agentOutputs = new Map<string, string>();
  let finalResponse = "";

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } } as any,
      ],
      tools: agentTools,
      messages,
    });

    // Emit any CEO thinking/text blocks
    for (const block of response.content) {
      if (block.type === "text" && block.text.trim()) {
        emit({ type: "ceo_thinking", content: block.text });
      }
    }

    if (response.stop_reason === "end_turn") {
      finalResponse = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: string; text: string }).text)
        .join("\n\n");
      emit({ type: "final_response", content: finalResponse });
      break;
    }

    if (response.stop_reason !== "tool_use") {
      finalResponse = "Analysis complete.";
      emit({ type: "final_response", content: finalResponse });
      break;
    }

    messages.push({ role: "assistant", content: response.content });

    // Extract all tool_use blocks and dispatch in parallel
    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");

    // Emit starts for all agents in this batch
    for (const block of toolUseBlocks) {
      emit({ type: "agent_start", agent: block.name as AgentName });
    }

    const toolResults: ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (block) => {
        if (block.type !== "tool_use") {
          return null as unknown as ToolResultBlockParam;
        }
        const agentName = block.name as AgentName;
        try {
          const handler = agentDispatch[block.name];
          if (!handler) throw new Error(`Unknown agent: ${block.name}`);

          const run = handler(block.input);
          const result = DEEP_AGENTS.has(block.name)
            ? await run
            : await withTimeout(run, STANDARD_TIMEOUT_MS, block.name);

          agentOutputs.set(block.name, result);
          emit({ type: "agent_complete", agent: agentName, result });
          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: result,
          };
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          emit({ type: "agent_error", agent: agentName, error: errorMsg });
          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: `Error: ${errorMsg}`,
            is_error: true,
          };
        }
      })
    );

    emit({ type: "ceo_compiling" });
    messages.push({ role: "user", content: toolResults });
  }

  // ── Skeptic validation pass ──────────────────────────────────────────────
  if (finalResponse) {
    emit({ type: "skeptic_start" });

    const agentSummaryLines = Array.from(agentOutputs.entries())
      .map(([name, output]) => `### ${name}\n${output.slice(0, 800)}${output.length > 800 ? "…" : ""}`)
      .join("\n\n");

    try {
      const skepticResponse = await anthropic.messages.create({
        model: SKEPTIC_MODEL,
        max_tokens: 600,
        messages: [
          {
            role: "user",
            content: `You are a skeptical financial analyst reviewing another analyst's research report. Your job is to identify weaknesses, flag overconfidence, and note any contradictions or missing context.

## CEO Report
${finalResponse.slice(0, 3000)}${finalResponse.length > 3000 ? "\n[truncated]" : ""}

## Sub-Agent Raw Outputs
${agentSummaryLines || "No sub-agent data collected."}

## Your Task
Write a concise second-opinion critique (3–5 bullet points, max 150 words). Focus on:
- Any claims that lack data support or are over-stated
- Contradictions between sub-agents (e.g. bullish sentiment vs negative technicals)
- Key risks or bearish factors the main report downplayed
- Data gaps that would change the conclusion

Be direct and constructive. Start with "**Skeptic Review:**"`,
          },
        ],
      });

      const critique =
        skepticResponse.content.find((b) => b.type === "text")?.text ?? "";
      emit({ type: "skeptic_complete", critique });
    } catch {
      // Skeptic is best-effort — don't fail the whole response
      emit({ type: "skeptic_complete", critique: "" });
    }
  }

  emit({ type: "done" });
}
