import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-sonnet-4-6";

// Lazily instantiated so the client is only created on first actual use,
// guaranteeing process.env is fully populated by Next.js before we read it.
let _client: Anthropic | undefined;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Add it to .env.local and restart the dev server."
      );
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

// Proxy so all existing `anthropic.messages.create(...)` call-sites keep working
// without any changes — the proxy forwards every property access to the lazily
// created client.
export const anthropic = new Proxy({} as Anthropic, {
  get(_target, prop: string | symbol) {
    const client = getClient();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
