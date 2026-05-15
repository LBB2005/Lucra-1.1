"use client";
import AgentStep from "./AgentStep";
import type { AgentStep as AgentStepType } from "@/types/chat";

interface Props {
  steps: AgentStepType[];
  ceoThinking?: string;
}

export default function AgentActivity({ steps, ceoThinking }: Props) {
  if (!steps.length && !ceoThinking) return null;

  const completed = steps.filter((s) => s.status === "complete").length;
  const total = steps.length;

  return (
    <div className="mx-auto w-full max-w-[720px] px-4">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-[var(--color-accent)] flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-[var(--color-text)]">Agent Mode</span>
          </div>
          {total > 0 && (
            <span className="text-xs text-[var(--color-muted)]">
              {completed}/{total} agents
            </span>
          )}
        </div>

        {steps.length > 0 && (
          <div className="flex flex-col gap-2">
            {steps.map((step) => (
              <AgentStep key={step.agent} step={step} />
            ))}
          </div>
        )}

        {ceoThinking && steps.every((s) => s.status === "complete" || s.status === "error") && (
          <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex items-center gap-2">
            <div className="flex gap-1">
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
            </div>
            <span className="text-xs text-[var(--color-muted)]">Synthesizing findings…</span>
          </div>
        )}
      </div>
    </div>
  );
}
