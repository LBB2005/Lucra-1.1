import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const conversations = await prisma.conversation.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    return NextResponse.json(conversations);
  } catch (err) {
    console.error("[conversations GET]", err);
    return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title } = body;
    const conversation = await prisma.conversation.create({
      data: { title: title ?? null },
      include: { messages: true },
    });
    return NextResponse.json(conversation, { status: 201 });
  } catch (err) {
    console.error("[conversations POST]", err);
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
  }
}
