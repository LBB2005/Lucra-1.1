"use client";
import { create } from "zustand";
import type { ChatMessage, ChatMode, AgentStep } from "@/types/chat";

interface ChatState {
  conversationId: string | null;
  messages: ChatMessage[];
  mode: ChatMode;
  isStreaming: boolean;
  streamingContent: string;
  agentSteps: AgentStep[];
  ceoThinking: string;
  pendingCritique: string;

  pendingMessage: string;
  setPendingMessage: (msg: string) => void;
  setPendingCritique: (c: string) => void;
  setConversationId: (id: string | null) => void;
  setMode: (mode: ChatMode) => void;
  addMessage: (msg: ChatMessage) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  setStreaming: (v: boolean) => void;
  appendStreamChunk: (chunk: string) => void;
  clearStreamingContent: () => void;
  setAgentSteps: (steps: AgentStep[]) => void;
  updateAgentStep: (agent: string, update: Partial<AgentStep>) => void;
  clearAgentSteps: () => void;
  setCeoThinking: (text: string) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  pendingMessage: "",
  setPendingMessage: (msg) => set({ pendingMessage: msg }),
  pendingCritique: "",
  setPendingCritique: (c) => set({ pendingCritique: c }),
  conversationId: null,
  messages: [],
  mode: "simple",
  isStreaming: false,
  streamingContent: "",
  agentSteps: [],
  ceoThinking: "",

  setConversationId: (id) => set({ conversationId: id }),
  setMode: (mode) => set({ mode }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setMessages: (msgs) => set({ messages: msgs }),
  setStreaming: (v) => set({ isStreaming: v }),
  appendStreamChunk: (chunk) =>
    set((s) => ({ streamingContent: s.streamingContent + chunk })),
  clearStreamingContent: () => set({ streamingContent: "" }),
  setAgentSteps: (steps) => set({ agentSteps: steps }),
  updateAgentStep: (agent, update) =>
    set((s) => ({
      agentSteps: s.agentSteps.map((step) =>
        step.agent === agent ? { ...step, ...update } : step
      ),
    })),
  clearAgentSteps: () => set({ agentSteps: [] }),
  setCeoThinking: (text) => set({ ceoThinking: text }),
  reset: () =>
    set({
      conversationId: null,
      messages: [],
      isStreaming: false,
      streamingContent: "",
      agentSteps: [],
      ceoThinking: "",
      pendingCritique: "",
    }),
}));
