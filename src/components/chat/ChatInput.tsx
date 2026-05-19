"use client";
import { useRef, useEffect, type KeyboardEvent } from "react";
import type { ChatMode } from "@/types/chat";
import { AGENT_COUNT } from "@/types/chat";

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  mode: ChatMode;
}

export default function ChatInput({ onSend, disabled, mode }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!disabled) ref.current?.focus();
  }, [disabled]);

  function resize() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  }

  function submit() {
    const val = ref.current?.value.trim();
    if (!val || disabled) return;
    onSend(val);
    if (ref.current) { ref.current.value = ""; ref.current.style.height = "auto"; }
  }

  const placeholder =
    mode === "agent"
      ? `Ask a research question — ${AGENT_COUNT} agents will analyze it…`
      : "Ask about a stock, sector, or your portfolio…";

  return (
    <div
      className="flex-shrink-0 px-6 pb-6 pt-3"
      style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0) 0%, var(--color-bg) 28%)" }}
    >
      <div className="mx-auto max-w-[720px]">
        <div
          className="relative flex items-end transition-all duration-200"
          style={{
            background: "var(--color-bg)",
            border: `1px solid var(--color-border)`,
            borderRadius: 16,
            boxShadow: disabled ? "none" : "0 1px 4px rgba(15,23,42,0.04)",
            opacity: disabled ? 0.6 : 1,
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = "var(--color-border-strong)";
            (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 18px rgba(15,23,42,0.07)";
          }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
              (e.currentTarget as HTMLDivElement).style.borderColor = "var(--color-border)";
              (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(15,23,42,0.04)";
            }
          }}
        >
          <textarea
            ref={ref}
            rows={1}
            placeholder={placeholder}
            disabled={disabled}
            onInput={resize}
            onKeyDown={handleKey}
            className="flex-1 resize-none bg-transparent focus:outline-none py-3.5 pl-[18px] pr-[52px] leading-[1.55] text-[14px]"
            style={{
              color: "var(--color-text)",
              maxHeight: 180,
              fontFamily: "var(--font-sans)",
            }}
          />

          <button
            onClick={submit}
            disabled={disabled}
            className="absolute right-2 bottom-2 w-[30px] h-[30px] rounded-full flex items-center justify-center transition-colors duration-150"
            style={{ background: "var(--color-accent)", color: "white" }}
            onMouseEnter={(e) => !disabled && ((e.currentTarget as HTMLButtonElement).style.background = "var(--color-accent-hover)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--color-accent)")}
          >
            {disabled ? (
              <span
                className="inline-block rounded-full border-2 border-white border-t-transparent"
                style={{ width: 13, height: 13, animation: "spin 0.9s linear infinite" }}
              />
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            )}
          </button>
        </div>

        <p className="text-center text-[10.5px] text-[var(--color-muted)] mt-2 tracking-[0.04em]">
          Not financial advice · Always do your own research
        </p>
      </div>
    </div>
  );
}
