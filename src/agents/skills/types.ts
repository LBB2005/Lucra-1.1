export interface AgentSkill {
  /** Expert identity and backstory — sets the agent's voice and perspective */
  persona: string;
  /** What this agent is exceptionally good at */
  strengths: string[];
  /** Specific analytical instructions that improve output quality */
  promptEnhancements: string[];
  /** Accumulated financial wisdom and known market patterns for this domain */
  learnedPatterns: string[];
}
