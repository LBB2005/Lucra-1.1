"use client";
import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { useAuth } from "@/context/AuthContext";
import { authFetcher, authFetch } from "@/lib/authFetch";

interface UserData {
  uid: string;
  name: string | null;
  email: string | null;
  photoURL: string | null;
  createdAt: string | null;
  plan: string;
  allowDataTraining: boolean;
  locationMetadata: boolean;
  stats: { conversations: number; briefings: number };
}

const SECTIONS = [
  { id: "general", label: "General" },
  { id: "account", label: "Account" },
  { id: "privacy", label: "Privacy & Data" },
  { id: "billing", label: "Billing / Plan" },
  { id: "usage", label: "Usage" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-[22px] w-[40px] flex-shrink-0 items-center rounded-full transition-colors duration-200"
      style={{ background: checked ? "var(--color-accent)" : "var(--color-border-strong)" }}
    >
      <span
        className="inline-block h-[16px] w-[16px] transform rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: checked ? "translateX(20px)" : "translateX(3px)" }}
      />
    </button>
  );
}

function SettingRow({
  label,
  description,
  children,
  danger,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-medium" style={{ color: danger ? "var(--color-bear)" : "var(--color-text)" }}>
          {label}
        </p>
        {description && (
          <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            {description}
          </p>
        )}
      </div>
      <div className="flex-shrink-0 flex items-center">{children}</div>
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-2">
      <h2 className="text-[17px] font-semibold" style={{ color: "var(--color-text)" }}>
        {title}
      </h2>
      {description && (
        <p className="text-[12.5px] mt-1" style={{ color: "var(--color-text-secondary)" }}>
          {description}
        </p>
      )}
      <div className="mt-4" style={{ borderBottom: "1px solid var(--color-border)" }} />
    </div>
  );
}

function ActionBtn({
  onClick,
  danger,
  children,
}: {
  onClick?: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-[6px] text-[12.5px] font-medium rounded-[7px] border transition-colors duration-150"
      style={
        danger
          ? {
              color: "var(--color-bear)",
              border: "1px solid var(--color-bear)",
              background: "transparent",
            }
          : {
              color: "var(--color-text)",
              border: "1px solid var(--color-border-strong)",
              background: "var(--color-surface)",
            }
      }
      onMouseEnter={(e) => {
        const btn = e.currentTarget;
        btn.style.background = danger ? "color-mix(in oklab, var(--color-bear) 8%, transparent)" : "var(--color-surface-2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = localStorage.getItem("lucra-theme") as "light" | "dark" | null;
    setTheme(stored ?? "light");
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("lucra-theme", next);
    if (next === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  return { theme, toggle };
}

// ─── Sections ────────────────────────────────────────────────────────────────

function GeneralSection() {
  const { theme, toggle } = useTheme();

  return (
    <div>
      <SectionHeader title="General" description="App-wide preferences and appearance." />
      <SettingRow label="Appearance" description="Choose between light and dark theme.">
        <div className="flex items-center gap-[3px] p-[3px] rounded-[8px]" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          {(["light", "dark"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { if (theme !== t) toggle(); }}
              className="px-3 py-[5px] text-[12px] font-medium rounded-[5px] capitalize transition-all duration-150"
              style={
                theme === t
                  ? { background: "var(--color-bg)", color: "var(--color-accent)", boxShadow: "0 1px 2px rgba(15,23,42,0.06)", fontWeight: 600 }
                  : { color: "var(--color-text-secondary)" }
              }
            >
              {t}
            </button>
          ))}
        </div>
      </SettingRow>
      <SettingRow label="Language" description="Language used across the app.">
        <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>English</span>
      </SettingRow>
    </div>
  );
}

function AccountSection({ userData, mutate }: { userData: UserData | undefined; mutate: () => void }) {
  const { signOut } = useAuth();
  const [name, setName] = useState(userData?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (userData?.name) setName(userData.name);
  }, [userData?.name]);

  async function saveName() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await authFetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name.trim() }),
      });
      mutate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const initials = (userData?.name ?? userData?.email ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const memberSince = userData?.createdAt
    ? new Date(userData.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "—";

  return (
    <div>
      <SectionHeader title="Account" description="Manage your profile information." />

      {/* Avatar row */}
      <div className="flex items-center gap-4 py-5" style={{ borderBottom: "1px solid var(--color-border)" }}>
        {userData?.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={userData.photoURL}
            alt={userData.name ?? ""}
            className="w-14 h-14 rounded-full object-cover flex-shrink-0"
            style={{ border: "2px solid var(--color-border)" }}
          />
        ) : (
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
            style={{ background: "var(--color-accent-light)", color: "var(--color-accent)", border: "2px solid var(--color-border)" }}
          >
            {initials}
          </div>
        )}
        <div>
          <p className="text-[14px] font-semibold" style={{ color: "var(--color-text)" }}>{userData?.name ?? "—"}</p>
          <p className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>{userData?.email ?? "—"}</p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--color-muted)" }}>Member since {memberSince}</p>
        </div>
      </div>

      <SettingRow label="Display name" description="How your name appears across the app.">
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
            className="text-[13px] px-3 py-[6px] rounded-[7px] outline-none transition-colors duration-150"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border-strong)",
              color: "var(--color-text)",
              width: 180,
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-accent)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border-strong)"; }}
          />
          <button
            onClick={saveName}
            disabled={saving || !name.trim()}
            className="px-3 py-[6px] text-[12.5px] font-medium rounded-[7px] transition-colors duration-150 disabled:opacity-50"
            style={{ background: "var(--color-accent)", color: "#fff" }}
          >
            {saved ? "Saved" : saving ? "Saving…" : "Save"}
          </button>
        </div>
      </SettingRow>

      <SettingRow label="Email" description="Your login email address. Managed by Google.">
        <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{userData?.email ?? "—"}</span>
      </SettingRow>

      <div className="pt-6">
        <ActionBtn onClick={signOut}>Sign out</ActionBtn>
      </div>
    </div>
  );
}

function PrivacySection({ userData, mutate }: { userData: UserData | undefined; mutate: () => void }) {
  async function patch(key: string, value: boolean) {
    await authFetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    mutate();
  }

  return (
    <div>
      <SectionHeader
        title="Privacy & Data"
        description="Control how Lucra uses and stores your data."
      />

      <SettingRow
        label="Help improve Lucra"
        description="Allow the use of your chats and sessions to improve AI models. You can opt out at any time."
      >
        <Toggle
          checked={userData?.allowDataTraining ?? true}
          onChange={(v) => patch("allowDataTraining", v)}
        />
      </SettingRow>

      <SettingRow
        label="Location metadata"
        description="Allow Lucra to use coarse location data (city/region) to improve market context."
      >
        <Toggle
          checked={userData?.locationMetadata ?? true}
          onChange={(v) => patch("locationMetadata", v)}
        />
      </SettingRow>

      <SettingRow label="Export data" description="Download a copy of all your conversations, portfolio, and preferences.">
        <ActionBtn>Export data</ActionBtn>
      </SettingRow>

      <SettingRow
        label="Delete account"
        description="Permanently delete your account and all associated data. This action cannot be undone."
        danger
      >
        <ActionBtn danger>Delete account</ActionBtn>
      </SettingRow>
    </div>
  );
}

function BillingSection({ userData, mutate }: { userData: UserData | undefined; mutate: () => void }) {
  const planColors: Record<string, { bg: string; text: string; border: string }> = {
    Pro: { bg: "var(--color-accent-light)", text: "var(--color-accent)", border: "var(--color-accent-medium)" },
    Free: { bg: "var(--color-surface-2)", text: "var(--color-text-secondary)", border: "var(--color-border-strong)" },
  };
  const plan = userData?.plan ?? "Pro";
  const colors = planColors[plan] ?? planColors.Pro;

  async function setPlan(p: string) {
    await authFetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: p }),
    });
    mutate();
  }

  return (
    <div>
      <SectionHeader title="Billing / Plan" description="Your current subscription and payment details." />

      <SettingRow label="Current plan" description="Your active Lucra subscription tier.">
        <div className="flex items-center gap-3">
          <span
            className="px-2.5 py-[3px] text-[12px] font-semibold rounded-full"
            style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
          >
            {plan}
          </span>
        </div>
      </SettingRow>

      <SettingRow label="Adjust plan" description="Upgrade or change your subscription.">
        <div className="flex gap-2">
          {["Free", "Pro"].filter((p) => p !== plan).map((p) => (
            <ActionBtn key={p} onClick={() => setPlan(p)}>Switch to {p}</ActionBtn>
          ))}
        </div>
      </SettingRow>

      <SettingRow label="Payment" description="Manage your payment method via Stripe.">
        <ActionBtn>Manage billing</ActionBtn>
      </SettingRow>

      <SettingRow label="Auto-reload" description="Automatically add credits when your balance runs low.">
        <ActionBtn>Configure</ActionBtn>
      </SettingRow>
    </div>
  );
}

function UsageSection({ userData }: { userData: UserData | undefined }) {
  const stats = userData?.stats;

  function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
    return (
      <div
        className="flex-1 rounded-[10px] p-4"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--color-muted)" }}>
          {label}
        </p>
        <p className="text-[28px] font-bold leading-none mt-2" style={{ color: "var(--color-text)", fontFamily: "var(--font-serif)" }}>
          {value}
        </p>
        {sub && <p className="text-[11px] mt-1" style={{ color: "var(--color-text-secondary)" }}>{sub}</p>}
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title="Usage" description="Your activity and usage across Lucra." />

      <div className="flex gap-3 mt-2 mb-6">
        <StatCard label="Conversations" value={stats?.conversations ?? "—"} sub="all time" />
        <StatCard label="Briefings" value={stats?.briefings ?? "—"} sub="generated" />
      </div>

      <SettingRow label="Daily routine runs" description="Scheduled agent routines included in your plan.">
        <span className="text-[13px] font-semibold" style={{ color: "var(--color-text)" }}>1 / 5</span>
      </SettingRow>

      <SettingRow label="Weekly limit" description="All models usage. Resets every Wednesday.">
        <div className="flex items-center gap-3">
          <div className="w-32 h-[6px] rounded-full overflow-hidden" style={{ background: "var(--color-border)" }}>
            <div className="h-full rounded-full" style={{ width: "69%", background: "var(--color-accent)" }} />
          </div>
          <span className="text-[12px] font-medium" style={{ color: "var(--color-text-secondary)" }}>69%</span>
        </div>
      </SettingRow>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [active, setActive] = useState<SectionId>("general");
  const { data: userData, mutate } = useSWR<UserData>("/api/user", authFetcher);

  const contentRef = useRef<HTMLDivElement>(null);

  function nav(id: SectionId) {
    setActive(id);
    contentRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }

  return (
    <div className="flex h-full" style={{ background: "var(--color-bg)" }}>
      {/* Left nav */}
      <nav
        className="flex-shrink-0 flex flex-col pt-8 pb-4 px-3"
        style={{
          width: 210,
          borderRight: "1px solid var(--color-border)",
          background: "var(--color-sidebar)",
        }}
      >
        <p
          className="px-3 mb-4 text-[10.5px] font-bold uppercase tracking-[0.2em]"
          style={{ color: "var(--color-muted)" }}
        >
          Settings
        </p>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => nav(s.id)}
            className="w-full text-left px-3 py-[7px] rounded-[7px] text-[13.5px] font-medium transition-colors duration-100 mb-[2px]"
            style={
              active === s.id
                ? { background: "var(--color-accent-light)", color: "var(--color-accent)", fontWeight: 600 }
                : { color: "var(--color-text-secondary)", background: "transparent" }
            }
            onMouseEnter={(e) => {
              if (active !== s.id) e.currentTarget.style.background = "var(--color-surface)";
            }}
            onMouseLeave={(e) => {
              if (active !== s.id) e.currentTarget.style.background = "transparent";
            }}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {/* Right content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto">
        <div className="max-w-[640px] mx-auto px-10 py-10">
          {active === "general" && <GeneralSection />}
          {active === "account" && <AccountSection userData={userData} mutate={mutate} />}
          {active === "privacy" && <PrivacySection userData={userData} mutate={mutate} />}
          {active === "billing" && <BillingSection userData={userData} mutate={mutate} />}
          {active === "usage" && <UsageSection userData={userData} />}
        </div>
      </div>
    </div>
  );
}
