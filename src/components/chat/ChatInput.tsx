"use client";
import { useRef, useEffect, type KeyboardEvent } from "react";
import type { ChatMode } from "@/types/chat";

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

  const placeholder = mode === "agent"
    ? "Ask a research question — agents will analyze it in depth…"
    : "Ask anything about your portfolio or a stock…";

  return (
    <div
      className="flex-shrink-0 px-5 pb-6 pt-3"
      style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0) 0%, #ffffff 28%)" }}
    >
      <div className="mx-auto max-w-[740px]">
        <div className={`relative flex rounded-2xl border bg-white transition-all duration-200 ${
          disabled
            ? "opacity-50 border-[var(--color-border)]"
            : "border-[var(--color-border)] shadow-[0_1px_6px_rgba(0,0,0,0.05)] focus-within:border-slate-300 focus-within:shadow-[0_2px_18px_rgba(0,0,0,0.07)]"
        }`}>
          <textarea
            ref={ref}
            rows={1}
            placeholder={placeholder}
            disabled={disabled}
            onInput={resize}
            onKeyDown={handleKey}
            className="flex-1 resize-none bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none py-3.5 pl-4 pr-11 leading-relaxed"
            style={{ maxHeight: "180px" }}
          />

          <button
            onClick={submit}
            disabled={disabled}
            className={`absolute right-3 bottom-3 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
              disabled
                ? "text-[var(--color-border)] cursor-not-allowed"
                : "bg-[var(--color-accent)] text-white hover:opacity-80 cursor-pointer shadow-sm"
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>

        <p className="text-center text-[10px] text-[var(--color-muted)] mt-2 tracking-wide">
          Not financial advice · Always do your own research
        </p>
      </div>
    </div>
  );
}
