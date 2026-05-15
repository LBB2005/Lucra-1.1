import { anthropic, MODEL } from "@/lib/anthropic";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { messages, portfolioContext } = await req.json();

  const systemPrompt = `You are Lucra, an expert AI financial research assistant. You help users research stocks, analyze their portfolio, and make informed investment decisions.

${portfolioContext ? `## User's Current Portfolio\n${portfolioContext}` : "The user has no portfolio holdings yet."}

Be concise, data-driven, and actionable. When making recommendations, always note that this is not financial advice. Use markdown formatting for clarity (tables, bullet points, etc.).`;

  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: 4096,
    system: [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } } as any,
    ],
    messages: messages as MessageParam[],
  });

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const data = JSON.stringify({ text: event.delta.text });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Stream error";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
