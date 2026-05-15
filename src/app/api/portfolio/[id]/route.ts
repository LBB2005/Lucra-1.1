import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { shares, avgCost, companyName, sector } = body;

    const holding = await prisma.holding.update({
      where: { id },
      data: {
        ...(shares !== undefined && { shares }),
        ...(avgCost !== undefined && { avgCost }),
        ...(companyName !== undefined && { companyName }),
        ...(sector !== undefined && { sector }),
      },
    });

    return NextResponse.json(holding);
  } catch (err) {
    console.error("[portfolio PATCH]", err);
    return NextResponse.json({ error: "Failed to update holding" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.holding.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[portfolio DELETE]", err);
    return NextResponse.json({ error: "Failed to delete holding" }, { status: 500 });
  }
}
