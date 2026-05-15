export type ChatMode = "simple" | "agent";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode: ChatMode;
  createdAt: string;
  agentTrace?: AgentStep[];
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
  | "options_agent";

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
  | { type: "text_delta"; content: string }
  | { type: "done" }
  | { type: "error"; message: string };
