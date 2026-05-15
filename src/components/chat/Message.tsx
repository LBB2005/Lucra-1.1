"use client";
import { useState } from "react";
import Markdown from "./Markdown";
import { AGENT_LABELS } from "@/types/chat";
import type { ChatMessage, AgentStep } from "@/types/chat";

function LucraIcon({ size = 28 }: { size?: number }) {
  return (
    <div
      className="rounded-xl bg-[var(--color-accent)] flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    </div>
  );
}

function AgentTraceRow({ step, expanded, onToggle }: { step: AgentStep; expanded: boolean; onToggle: () => void }) {
  const label = AGENT_LABELS[step.agent] ?? step.agent;
  return (
    <div className="flex flex-col">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 py-1 text-left group"
      >
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
        <span className="text-[11px] font-medium text-[var(--color-text-secondary)] group-hover:text-[var(--color-text)] transition-colors duration-100">
          {label}
        </span>
        {step.status === "complete" && step.result && (
          <svg
            width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className={`ml-auto text-[var(--color-muted)] transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
        {step.status === "error" && (
          <span className="ml-auto text-[10px] text-red-400">error</span>
        )}
      </button>
      {expanded && step.result && (
        <div className="ml-5 pl-3 border-l border-[var(--color-border)] mb-1">
          <p className="text-[11px] text-[var(--color-muted)] leading-relaxed whitespace-pre-wrap">
            {step.result.slice(0, 600)}{step.result.length > 600 ? "…" : ""}
          </p>
        </div>
      )}
      {expanded && step.error && (
        <p className="ml-5 text-[11px] text-red-400 mb-1">{step.error}</p>
      )}
    </div>
  );
}

function AgentTrace({ steps }: { steps: AgentStep[] }) {
  const [open, setOpen] = useState(false);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const completed = steps.filter((s) => s.status === "complete").length;
  const errors = steps.filter((s) => s.status === "error").length;

  return (
    <div className="mt-3 border border-[var(--color-border)] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-[var(--color-surface)] hover:bg-[var(--color-sidebar-hover)] transition-colors duration-150"
      >
        <div className="w-4 h-4 rounded bg-[var(--color-accent)] flex items-center justify-center flex-shrink-0">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="text-[11px] font-semibold text-[var(--color-text-secondary)]">
          {completed} agent{completed !== 1 ? "s" : ""} ran
          {errors > 0 && <span className="text-red-400 ml-1">· {errors} error{errors !== 1 ? "s" : ""}</span>}
        </span>
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`ml-auto text-[var(--color-muted)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="px-3 py-2 flex flex-col divide-y divide-[var(--color-border)]">
          {steps.map((step) => (
            <AgentTraceRow
              key={step.agent}
              step={step}
              expanded={expandedStep === step.agent}
              onToggle={() => setExpandedStep((v) => v === step.agent ? null : step.agent)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Message({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] bg-[var(--color-user-bubble)] text-white rounded-2xl rounded-tr-sm px-4 py-3 text-[0.9rem] leading-relaxed shadow-md shadow-blue-900/15">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3.5 group">
      <LucraIcon size={28} />
      <div className="flex-1 min-w-0 pt-0.5">
        <Markdown>{message.content}</Markdown>
        {message.agentTrace && message.agentTrace.length > 0 && (
          <AgentTrace steps={message.agentTrace} />
        )}
        <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <span className="text-[11px] text-[var(--color-muted)]">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {message.mode === "agent" && (
            <span className="bg-[var(--color-accent-light)] text-[var(--color-accent)] px-1.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide">
              AGENT
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
