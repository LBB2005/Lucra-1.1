import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.conversation.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[conversation DELETE]", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { title } = await req.json();
    const updated = await prisma.conversation.update({
      where: { id },
      data: { title },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[conversation PATCH]", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
