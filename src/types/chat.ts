export type ChatMode = "simple" | "agent";

/** Total number of sub-agents the CEO can dispatch (excludes the skeptic post-pass) */
export const AGENT_COUNT = 15;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode: ChatMode;
  createdAt: string;
  agentTrace?: AgentStep[];
  critique?: string;
}

export type AgentName =
  | "risk_agent"
  | "news_agent"
  | "macro_agent"
  | "technical_agent"
  | "dcf_agent"
  | "earnings_agent"
  | "insider_agent"
  | "sentiment_agent"
  | "competitor_agent"
  | "options_agent"
  | "run_comparables_agent"
  | "run_graham_agent"
  | "run_analyst_agent"
  | "run_hype_agent"
  | "run_fundamentals_agent"
  | "skeptic_review";

export const AGENT_LABELS: Record<AgentName, string> = {
  risk_agent: "Risk Analysis",
  news_agent: "News Research",
  macro_agent: "Macro & Market",
  technical_agent: "Technical Analysis",
  dcf_agent: "DCF Valuation",
  earnings_agent: "Earnings & Catalysts",
  insider_agent: "Insider & Institutional",
  sentiment_agent: "Social Sentiment",
  competitor_agent: "Competitor Analysis",
  options_agent: "Options Flow",
  run_comparables_agent: "Comparables",
  run_graham_agent: "Graham Screen",
  run_analyst_agent: "Analyst Consensus",
  run_hype_agent: "🔥 Hype Score",
  run_fundamentals_agent: "Multi-Year Fundamentals",
  skeptic_review: "Skeptic Review",
};

export type AgentStatus = "pending" | "running" | "complete" | "error";

export interface AgentStep {
  agent: AgentName;
  status: AgentStatus;
  result?: string;
  error?: string;
}

export type AgentEvent =
  | { type: "agent_start"; agent: AgentName }
  | { type: "agent_complete"; agent: AgentName; result: string }
  | { type: "agent_error"; agent: AgentName; error: string }
  | { type: "ceo_thinking"; content: string }
  | { type: "ceo_compiling" }
  | { type: "final_response"; content: string }
  | { type: "skeptic_start" }
  | { type: "skeptic_complete"; critique: string }
  | { type: "text_delta"; content: string }
  | { type: "done" }
  | { type: "error"; message: string };
