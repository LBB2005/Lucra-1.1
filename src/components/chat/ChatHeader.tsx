"use client";
import type { ChatMode } from "@/types/chat";

interface Props {
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
}

export default function ChatHeader({ mode, onModeChange }: Props) {
  return (
    <div className="flex-shrink-0 flex items-center justify-center px-6 py-3 border-b border-[var(--color-border)] bg-white">
      <div className="flex items-center gap-1 bg-[var(--color-surface)] rounded-xl p-1 border border-[var(--color-border)]">
        <button
          onClick={() => onModeChange("simple")}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            mode === "simple"
              ? "bg-white text-[var(--color-accent)] shadow-sm border border-[var(--color-border)]"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          }`}
        >
          Chat
        </button>
        <button
          onClick={() => onModeChange("agent")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            mode === "agent"
              ? "bg-white text-[var(--color-accent)] shadow-sm border border-[var(--color-border)]"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
          </svg>
          Agent Mode
          {mode === "agent" && (
            <span className="ml-0.5 text-[10px] bg-[var(--color-accent-light)] text-[var(--color-accent)] px-1.5 py-0.5 rounded-full font-semibold">
              10
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
