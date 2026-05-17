"use client";
import { useCallback, useEffect } from "react";
import { useChatStore } from "@/stores/chatStore";
import { usePortfolio } from "@/hooks/usePortfolio";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import type { ChatMessage, AgentEvent, AgentStep } from "@/types/chat";

function buildPortfolioContext(
  holdings: ReturnType<typeof usePortfolio>["holdings"],
  cashBalance: number
): string {
  const lines = holdings.map(
    (h) =>
      `- ${h.ticker}${h.companyName ? ` (${h.companyName})` : ""}: ${h.shares} shares @ avg $${h.avgCost}${h.sector ? `, sector: ${h.sector}` : ""}`
  );
  const parts: string[] = [];
  if (lines.length) parts.push(`The user's portfolio:\n${lines.join("\n")}`);
  if (cashBalance > 0) parts.push(`Available buying power / cash: $${cashBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  return parts.join("\n\n");
}

export default function ChatContainer() {
  const {
    messages,
    mode,
    isStreaming,
    streamingContent,
    agentSteps,
    ceoThinking,
    conversationId,
    setMode,
    addMessage,
    setMessages,
    setStreaming,
    appendStreamChunk,
    clearStreamingContent,
    setAgentSteps,
    updateAgentStep,
    setCeoThinking,
    setConversationId,
    pendingMessage,
    setPendingMessage,
    setPendingCritique,
  } = useChatStore();

  const { holdings, cashBalance } = usePortfolio();


  async function ensureConversation(): Promise<string> {
    if (conversationId) return conversationId;
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: null }),
    });
    const data = await res.json();
    setConversationId(data.id);
    return data.id;
  }

  async function saveMessage(
    convId: string,
    role: "user" | "assistant",
    content: string,
    agentTrace?: AgentStep[]
  ) {
    await fetch(`/api/conversations/${convId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, content, mode, agentTrace }),
    });
  }

  const handleSend = useCallback(
    async (text: string) => {
      if (isStreaming) return;
      console.log("[handleSend] mode:", mode, "text:", text.slice(0, 40));

      try {
        const convId = await ensureConversation();
        const portfolioContext = buildPortfolioContext(holdings, cashBalance);

        const userMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "user",
          content: text,
          mode,
          createdAt: new Date().toISOString(),
        };
        addMessage(userMsg);

        // Save message best-effort — don't let a DB error block the response
        saveMessage(convId, "user", text).catch((e) =>
          console.warn("[handleSend] saveMessage failed:", e)
        );

        setStreaming(true);
        clearStreamingContent();

        if (mode === "simple") {
          await runSimpleChat(text, portfolioContext, convId);
        } else {
          await runAgentMode(text, portfolioContext, convId);
        }
      } catch (err) {
        console.error("[handleSend] top-level error:", err);
        setStreaming(false);
        clearStreamingContent();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isStreaming, mode, holdings, cashBalance, conversationId]
  );

  async function runSimpleChat(text: string, portfolioContext: string, convId: string) {
    const apiMessages = [
      ...messages.filter((m) => m.mode === "simple"),
      { role: "user" as const, content: text },
    ].map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, portfolioContext }),
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              appendStreamChunk(parsed.text);
              fullContent += parsed.text;
            }
          } catch { /* ignore */ }
        }
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: fullContent,
        mode: "simple",
        createdAt: new Date().toISOString(),
      };
      addMessage(assistantMsg);
      await saveMessage(convId, "assistant", fullContent);
    } finally {
      setStreaming(false);
      clearStreamingContent();
    }
  }

  async function runAgentMode(text: string, portfolioContext: string, convId: string) {
    setAgentSteps([]);
    setCeoThinking("");

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userPrompt: text, portfolioContext }),
      });

      if (!res.ok || !res.body) throw new Error("Agent stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let finalContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as AgentEvent;
            handleAgentEvent(event);
            if (event.type === "final_response") finalContent = event.content;
          } catch { /* ignore */ }
        }
      }

      if (finalContent) {
        const completedSteps = useChatStore.getState().agentSteps;
        const critique = useChatStore.getState().pendingCritique;
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: finalContent,
          mode: "agent",
          createdAt: new Date().toISOString(),
          agentTrace: completedSteps,
          critique: critique || undefined,
        };
        addMessage(assistantMsg);
        // Clear for next run
        setPendingCritique("");
        await saveMessage(convId, "assistant", finalContent, completedSteps);
      }
    } finally {
      setStreaming(false);
      clearStreamingContent();
    }
  }

  function handleAgentEvent(event: AgentEvent) {
    switch (event.type) {
      case "agent_start": {
        const newStep: AgentStep = { agent: event.agent, status: "running" };
        setAgentSteps([
          ...useChatStore.getState().agentSteps.filter((s) => s.agent !== event.agent),
          newStep,
        ]);
        break;
      }
      case "agent_complete":
        updateAgentStep(event.agent, { status: "complete", result: event.result });
        break;
      case "agent_error":
        updateAgentStep(event.agent, { status: "error", error: event.error });
        break;
      case "ceo_thinking":
        setCeoThinking(event.content);
        break;
      case "ceo_compiling":
        setCeoThinking("Compiling all reports…");
        break;
      case "final_response":
        appendStreamChunk(event.content);
        break;
      case "skeptic_start": {
        const skepticStep: AgentStep = { agent: "skeptic_review", status: "running" };
        setAgentSteps([
          ...useChatStore.getState().agentSteps,
          skepticStep,
        ]);
        break;
      }
      case "skeptic_complete":
        updateAgentStep("skeptic_review", { status: "complete", result: event.critique });
        if (event.critique) setPendingCritique(event.critique);
        break;
      case "error":
        console.error("[agent error event]", event.message);
        appendStreamChunk(`\n\n**Error:** ${event.message}`);
        break;
    }
  }

  // Fire pending message routed from portfolio ask bar
  useEffect(() => {
    if (!pendingMessage) return;
    setPendingMessage("");
    handleSend(pendingMessage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMessage]);

  return (
    <div className="flex flex-col h-full">
      <ChatHeader mode={mode} onModeChange={setMode} />

      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        streamingContent={streamingContent}
        mode={mode}
        onSuggestion={handleSend}
        agentSteps={agentSteps}
        ceoThinking={ceoThinking}
      />

      <ChatInput onSend={handleSend} disabled={isStreaming} mode={mode} />
    </div>
  );
}
