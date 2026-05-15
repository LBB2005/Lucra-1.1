export default function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-lg bg-[var(--color-accent)] flex items-center justify-center flex-shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      </div>
      <div className="flex items-center gap-1 py-3">
        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-[var(--color-muted)]" />
        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-[var(--color-muted)]" />
        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-[var(--color-muted)]" />
      </div>
    </div>
  );
}
