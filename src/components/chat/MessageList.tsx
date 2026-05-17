"use client";
import { useEffect, useRef } from "react";
import Markdown from "./Markdown";
import Message from "./Message";
import { AGENT_LABELS } from "@/types/chat";
import type { ChatMessage, ChatMode, AgentStep } from "@/types/chat";

const SUGGESTIONS = [
  "What are my biggest position risks right now?",
  "Run a full DCF on my largest holding",
  "Which positions should I consider trimming?",
  "What's the macro environment saying about tech stocks?",
];

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

function Spinner({ size = 12, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-block rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

function AgentActivityInline({ steps, ceoThinking }: { steps: AgentStep[]; ceoThinking?: string }) {
  const hasSteps = steps.length > 0;
  const isCompiling = ceoThinking === "Compiling all reports…";
  const runningCount = steps.filter(s => s.status === "running").length;
  const doneCount = steps.filter(s => s.status === "complete").length;
  const errorCount = steps.filter(s => s.status === "error").length;

  return (
    <div className="flex gap-3">
      <LucraIcon />
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">

          {/* Header bar */}
          <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-[var(--color-border)] bg-white">
            <Spinner size={13} />
            <span className="text-xs font-semibold text-[var(--color-text)]">
              {!hasSteps
                ? "Deploying agents…"
                : isCompiling
                ? "Synthesizing findings…"
                : runningCount > 0
                ? `${runningCount} agent${runningCount > 1 ? "s" : ""} running…`
                : `${doneCount} agent${doneCount !== 1 ? "s" : ""} complete${errorCount > 0 ? ` · ${errorCount} error${errorCount !== 1 ? "s" : ""}` : ""}`
              }
            </span>
            {hasSteps && (
              <span className="ml-auto text-[11px] text-[var(--color-muted)]">
                {doneCount}/{steps.length}
              </span>
            )}
          </div>

          {/* No steps yet — initialising skeleton */}
          {!hasSteps && (
            <div className="px-4 py-3 flex flex-col gap-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-2.5 animate-pulse">
                  <span className="w-3 h-3 rounded-full bg-slate-200 flex-shrink-0" />
                  <span className="h-2.5 rounded bg-slate-200" style={{ width: `${55 + i * 18}px` }} />
                </div>
              ))}
            </div>
          )}

          {/* Step rows */}
          {hasSteps && (
            <div className="px-4 py-3 flex flex-col gap-0">
              {steps.map((step, i) => {
                const label = step.agent === "skeptic_review"
                  ? "🔍 Second Opinion"
                  : AGENT_LABELS[step.agent] ?? step.agent;
                const isSkeptic = step.agent === "skeptic_review";
                return (
                  <div
                    key={step.agent}
                    className={`flex items-center gap-2.5 py-1.5 ${
                      i > 0 && isSkeptic ? "mt-1 pt-2.5 border-t border-amber-200/60" : ""
                    }`}
                  >
                    {step.status === "running" && (
                      <Spinner size={12} className={isSkeptic ? "border-amber-500 border-t-transparent" : ""} />
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
                    <span className={`text-xs font-medium ${
                      step.status === "running"
                        ? isSkeptic ? "text-amber-600" : "text-[var(--color-accent)]"
                        : step.status === "complete"
                        ? "text-[var(--color-text-secondary)]"
                        : "text-red-400"
                    }`}>
                      {label}
                    </span>
                    {step.status === "running" && (
                      <span className="text-[11px] text-[var(--color-muted)] italic">Analyzing…</span>
                    )}
                    {step.status === "error" && step.error && (
                      <span className="text-[11px] text-red-400 truncate max-w-[160px]">{step.error}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Compiling footer */}
          {isCompiling && (
            <div className="px-4 pb-3 flex items-center gap-2">
              <span className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <span key={i} className="typing-dot w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" style={{ animationDelay: `${i * 160}ms` }} />
                ))}
              </span>
              <span className="text-[11px] text-[var(--color-muted)] italic">Writing your report…</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface Props {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  mode: ChatMode;
  onSuggestion?: (text: string) => void;
  agentSteps?: AgentStep[];
  ceoThinking?: string;
}

export default function MessageList({ messages, isStreaming, streamingContent, mode, onSuggestion, agentSteps = [], ceoThinking }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Show agent activity panel as soon as we start streaming in agent mode (before any steps arrive)
  const showAgentActivity = mode === "agent" && isStreaming && !streamingContent;
  const showStreaming = isStreaming && !!streamingContent;

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

        {/* Agent activity panel — shows immediately on submit, stays until streaming starts */}
        {showAgentActivity && (
          <AgentActivityInline steps={agentSteps} ceoThinking={ceoThinking} />
        )}

        {/* Streaming response (both modes) */}
        {showStreaming && (
          <div className="flex gap-3">
            <LucraIcon />
            <div className="flex-1 min-w-0 pt-0.5">
              <Markdown>{streamingContent}</Markdown>
              <span className="inline-block w-0.5 h-[1.1em] bg-[var(--color-accent)] animate-pulse align-text-bottom ml-0.5" />
            </div>
          </div>
        )}

        {/* Simple mode waiting dots */}
        {mode === "simple" && isStreaming && !streamingContent && (
          <div className="flex gap-3 items-start">
            <LucraIcon />
            <div className="pt-2 flex items-center gap-1.5">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="typing-dot w-2 h-2 rounded-full bg-[var(--color-accent)]"
                  style={{ animationDelay: `${i * 160}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
