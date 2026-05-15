import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { role, content, mode = "simple", agentTrace } = body;

    const message = await prisma.message.create({
      data: {
        conversationId: id,
        role,
        content,
        mode,
        agentTrace: agentTrace ? JSON.stringify(agentTrace) : null,
      },
    });

    // Touch conversation updatedAt
    await prisma.conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json(message, { status: 201 });
  } catch (err) {
    console.error("[messages POST]", err);
    return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
  }
}
