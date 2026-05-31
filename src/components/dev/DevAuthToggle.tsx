"use client";
import { useAuth } from "@/context/AuthContext";

export default function DevAuthToggle() {
  const { devEnabled, devBypass, toggleDevBypass } = useAuth();
  if (!devEnabled) return null;

  return (
    <button
      onClick={toggleDevBypass}
      title="Dev-only: bypass sign-in. Mock user has no real token, so authenticated data calls won't work."
      style={{
        position: "fixed",
        bottom: 12,
        right: 12,
        zIndex: 9999,
        padding: "5px 10px",
        borderRadius: 8,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.02em",
        fontFamily: "var(--font-mono, monospace)",
        cursor: "pointer",
        color: devBypass ? "#fff" : "var(--color-text-secondary)",
        background: devBypass ? "var(--color-accent)" : "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "0 2px 8px rgba(15,23,42,0.10)",
        opacity: 0.85,
      }}
    >
      {devBypass ? "● DEV AUTH ON" : "○ DEV AUTH OFF"}
    </button>
  );
}
