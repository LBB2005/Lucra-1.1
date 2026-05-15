"use client";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import Message from "./Message";
import TypingIndicator from "./TypingIndicator";
import { AGENT_LABELS } from "@/types/chat";
import type { ChatMessage, ChatMode, AgentStep } from "@/types/chat";

const SUGGESTIONS = [
  "What are my biggest position risks right now?",
  "Run a full DCF on my largest holding",
  "Which positions should I consider trimming?",
  "What's the macro environment saying about tech stocks?",
];

interface Props {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  mode: ChatMode;
  onSuggestion?: (text: string) => void;
  agentSteps?: AgentStep[];
  ceoThinking?: string;
}

function LucraIcon() {
  return (
    <div className="w-7 h-7 rounded-xl bg-[var(--color-accent)] flex items-center justify-center flex-shrink-0">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    </div>
  );
}

function AgentActivityInline({ steps, ceoThinking }: { steps: AgentStep[]; ceoThinking?: string }) {
  const isCompiling = ceoThinking === "Compiling all reports…";
  return (
    <div className="flex gap-3">
      <LucraIcon />
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 flex flex-col gap-2">
          {/* Running steps */}
          {steps.map((step) => {
            const label = AGENT_LABELS[step.agent] ?? step.agent;
            return (
              <div key={step.agent} className="flex items-center gap-2.5">
                {step.status === "running" && (
                  <span className="w-3 h-3 rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin flex-shrink-0" />
                )}
                {step.status === "complete" && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-emerald-500 flex-shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {step.status === "error" && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-red-400 flex-shrink-0">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                )}
                <span className={`text-xs ${
                  step.status === "running" ? "text-[var(--color-accent)] font-medium" :
                  step.status === "complete" ? "text-[var(--color-text-secondary)]" :
                  "text-red-400"
                }`}>
                  {label}
                </span>
                {step.status === "running" && (
                  <span className="text-[11px] text-[var(--color-muted)]">Analyzing…</span>
                )}
              </div>
            );
          })}

          {/* Compiling state */}
          {isCompiling && (
            <div className="flex items-center gap-2.5 pt-1 border-t border-[var(--color-border)] mt-1">
              <span className="flex gap-1">
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
              </span>
              <span className="text-xs text-[var(--color-muted)] italic">Compiling all reports…</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MessageList({ messages, isStreaming, streamingContent, mode, onSuggestion, agentSteps = [], ceoThinking }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const showAgentActivity = mode === "agent" && isStreaming && (agentSteps.length > 0 || !!ceoThinking);
  const showAgentStreaming = mode === "agent" && isStreaming && !!streamingContent;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingContent, agentSteps.length, ceoThinking]);

  if (!messages.length && !isStreaming) {
    return (
      <div className="flex-1 overflow-y-auto flex items-center justify-center px-6">
        <div className="w-full max-w-[520px]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-[var(--color-accent)] flex items-center justify-center shadow-md shadow-blue-900/20">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--color-text)]">Lucra Research</h1>
              <p className="text-sm text-[var(--color-muted)]">AI-powered portfolio analysis</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => onSuggestion?.(s)}
                className="text-left px-4 py-3 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-accent-medium)] hover:bg-[var(--color-accent-light)] hover:text-[var(--color-accent)] transition-all duration-150"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[740px] px-4 py-8 flex flex-col gap-7">
        {messages.map((msg) => <Message key={msg.id} message={msg} />)}

        {/* Agent activity — lives inside the scroll area */}
        {showAgentActivity && !showAgentStreaming && (
          <AgentActivityInline steps={agentSteps} ceoThinking={ceoThinking} />
        )}

        {/* Agent final response streaming */}
        {showAgentStreaming && (
          <div className="flex gap-3">
            <LucraIcon />
            <div className="flex-1 min-w-0 pt-0.5 prose-msg text-sm text-[var(--color-text)]">
              <ReactMarkdown>{streamingContent}</ReactMarkdown>
              <span className="inline-block w-0.5 h-[1.1em] bg-[var(--color-accent)] animate-pulse align-text-bottom ml-0.5" />
            </div>
          </div>
        )}

        {/* Simple chat streaming */}
        {mode === "simple" && isStreaming && streamingContent && (
          <div className="flex gap-3">
            <LucraIcon />
            <div className="flex-1 min-w-0 pt-0.5 prose-msg text-sm text-[var(--color-text)]">
              <ReactMarkdown>{streamingContent}</ReactMarkdown>
              <span className="inline-block w-0.5 h-[1.1em] bg-[var(--color-accent)] animate-pulse align-text-bottom ml-0.5" />
            </div>
          </div>
        )}

        {/* Typing dots before simple chat response arrives */}
        {mode === "simple" && isStreaming && !streamingContent && <TypingIndicator />}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
