"use client";
import type { ChatMode } from "@/types/chat";
import { AGENT_COUNT } from "@/types/chat";

interface Props {
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  title?: string;
  eyebrow?: string;
}

export default function ChatHeader({ mode, onModeChange, title = "Research", eyebrow }: Props) {
  const now = new Date();
  const dayLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div
      className="flex-shrink-0 flex items-center justify-between px-7 py-3"
      style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-bg)" }}
    >
      {/* Left: eyebrow + title */}
      <div className="flex items-baseline gap-3.5">
        <span
          className="text-[12px] italic"
          style={{ fontFamily: "var(--font-serif)", color: "var(--color-muted)" }}
        >
          {eyebrow ?? dayLabel}
        </span>
        <h1 className="m-0 text-[15px] font-semibold text-[var(--color-text)]">{title}</h1>
      </div>

      {/* Right: mode toggle */}
      <div
        className="inline-flex p-[3px] gap-[2px] rounded-[10px]"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <button
          onClick={() => onModeChange("simple")}
          className="flex items-center gap-[6px] px-3 py-[5px] text-[12.5px] font-medium rounded-[7px] transition-all duration-150"
          style={
            mode === "simple"
              ? {
                  background: "var(--color-bg)",
                  color: "var(--color-accent)",
                  boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
                  fontWeight: 600,
                }
              : { background: "transparent", color: "var(--color-text-secondary)" }
          }
        >
          Chat
        </button>

        <button
          onClick={() => onModeChange("agent")}
          className="flex items-center gap-[6px] px-3 py-[5px] text-[12.5px] font-medium rounded-[7px] transition-all duration-150"
          style={
            mode === "agent"
              ? {
                  background: "var(--color-bg)",
                  color: "var(--color-accent)",
                  boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
                  fontWeight: 600,
                }
              : { background: "transparent", color: "var(--color-text-secondary)" }
          }
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          Agent Mode
          <span
            className="text-[10px] px-1.5 py-[1px] rounded-full font-bold"
            style={{ background: "var(--color-accent-light)", color: "var(--color-accent)" }}
          >
            {AGENT_COUNT}
          </span>
        </button>
      </div>
    </div>
  );
}
