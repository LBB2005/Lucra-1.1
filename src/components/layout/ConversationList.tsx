"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useChatStore } from "@/stores/chatStore";

interface ConvMessage {
  id: string; role: string; content: string; mode: string; createdAt: string; agentTrace?: string;
}
interface Conversation {
  id: string; title: string | null; createdAt: string; updatedAt: string;
  messages: ConvMessage[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString("en-US", { weekday: "long" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getTitle(conv: Conversation): string {
  if (conv.title) return conv.title;
  const firstUser = conv.messages.find((m) => m.role === "user");
  if (firstUser) return firstUser.content.slice(0, 42) + (firstUser.content.length > 42 ? "…" : "");
  return "New conversation";
}

function getPinned(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try { return new Set(JSON.parse(localStorage.getItem("lucra_pinned") ?? "[]")); }
  catch { return new Set(); }
}

function savePinned(set: Set<string>) {
  localStorage.setItem("lucra_pinned", JSON.stringify([...set]));
}

export default function ConversationList() {
  const router = useRouter();
  const { data: conversations, mutate } = useSWR<Conversation[]>(
    "/api/conversations",
    fetcher,
    { refreshInterval: 30_000, revalidateOnFocus: true }
  );
  const [pinned, setPinned] = useState<Set<string>>(getPinned);

  const { conversationId, setConversationId, setMessages, setStreaming, clearStreamingContent, clearAgentSteps } = useChatStore();

  function loadConversation(conv: Conversation) {
    setMessages(conv.messages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      mode: m.mode as "simple" | "agent",
      createdAt: m.createdAt,
      agentTrace: m.agentTrace ? JSON.parse(m.agentTrace) : undefined,
    })));
    setConversationId(conv.id);
    setStreaming(false);
    clearStreamingContent();
    clearAgentSteps();
    router.push("/chat");
  }

  function togglePin(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      savePinned(next);
      return next;
    });
  }

  async function deleteConversation(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (conversationId === id) useChatStore.getState().reset();
    mutate();
  }

  if (!conversations?.length) {
    return <div className="px-3 py-2 text-xs text-[var(--color-muted)]">No chats yet</div>;
  }

  const pinnedConvs = conversations.filter((c) => pinned.has(c.id));
  const unpinned = conversations.filter((c) => !pinned.has(c.id));

  const groups: Record<string, Conversation[]> = {};
  unpinned.forEach((c) => {
    const label = formatDate(c.updatedAt);
    if (!groups[label]) groups[label] = [];
    groups[label].push(c);
  });

  function ConvRow({ conv }: { conv: Conversation }) {
    const isPinned = pinned.has(conv.id);
    const isActive = conversationId === conv.id;
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => loadConversation(conv)}
        onKeyDown={(e) => e.key === "Enter" && loadConversation(conv)}
        className={`group w-full text-left flex items-center gap-2 px-3 py-[7px] rounded-lg transition-colors duration-100 cursor-pointer select-none ${
          isActive
            ? "bg-[var(--color-sidebar-active)] text-[var(--color-accent)]"
            : "text-[var(--color-text-secondary)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-text)]"
        }`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="flex-shrink-0 opacity-40">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span className="flex-1 truncate text-[11px]">{getTitle(conv)}</span>
        <span className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={(e) => togglePin(e, conv.id)}
            className={`p-0.5 rounded transition-all duration-100 ${
              isPinned
                ? "text-[var(--color-accent)] opacity-100"
                : "opacity-0 group-hover:opacity-60 hover:!opacity-100 text-[var(--color-muted)]"
            }`}
            title={isPinned ? "Unpin" : "Pin"}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill={isPinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
          <button
            onClick={(e) => deleteConversation(e, conv.id)}
            className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-0.5 rounded hover:text-red-400 transition-all duration-100 text-[var(--color-muted)]"
            title="Delete"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {/* Pinned */}
      {pinnedConvs.length > 0 && (
        <div>
          <p className="px-3 pt-2 pb-1 text-[9px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
            Pinned
          </p>
          {pinnedConvs.map((conv) => <ConvRow key={conv.id} conv={conv} />)}
        </div>
      )}

      {/* Date groups */}
      {Object.entries(groups).map(([label, convs]) => (
        <div key={label}>
          <p className="px-3 pt-3 pb-1 text-[9px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
            {label}
          </p>
          {convs.map((conv) => <ConvRow key={conv.id} conv={conv} />)}
        </div>
      ))}
    </div>
  );
}
