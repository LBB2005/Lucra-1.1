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
import type { AgentEvent, AgentName } from "@/types/chat";
import type { MessageParam, ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages";

type EventEmitter = (event: AgentEvent) => void;

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
};

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

## Instructions
- Be decisive: deploy multiple agents when the question requires comprehensive analysis
- Don't call the same agent twice for the same data
- After all agents complete, do a **final compilation pass**: cross-reference findings, flag any contradictions, and produce a polished, well-structured report
- Always provide specific, actionable recommendations backed by the data
- End with a clear "Summary & Recommendation" section
- Note this is not financial advice`;

  const messages: MessageParam[] = [{ role: "user", content: userPrompt }];

  let iteration = 0;
  const MAX_ITERATIONS = 10;

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
      const finalText = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: string; text: string }).text)
        .join("\n\n");
      emit({ type: "final_response", content: finalText });
      break;
    }

    if (response.stop_reason !== "tool_use") {
      emit({ type: "final_response", content: "Analysis complete." });
      break;
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type !== "tool_use") continue;

      const agentName = block.name as AgentName;
      emit({ type: "agent_start", agent: agentName });

      try {
        const handler = agentDispatch[block.name];
        if (!handler) throw new Error(`Unknown agent: ${block.name}`);

        const result = await handler(block.input);
        emit({ type: "agent_complete", agent: agentName, result });
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        emit({ type: "agent_error", agent: agentName, error: errorMsg });
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: `Error: ${errorMsg}`,
          is_error: true,
        });
      }
    }

    // Signal that the CEO is now compiling all reports before the next call
    emit({ type: "ceo_compiling" });
    messages.push({ role: "user", content: toolResults });
  }

  emit({ type: "done" });
}
