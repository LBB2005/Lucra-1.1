import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

async function getOrCreate() {
  return prisma.portfolioSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", cashBalance: 0 },
  });
}

export async function GET() {
  try {
    const settings = await getOrCreate();
    return NextResponse.json(settings);
  } catch (err) {
    console.error("[settings GET]", err);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { cashBalance } = await req.json();
    if (typeof cashBalance !== "number" || cashBalance < 0) {
      return NextResponse.json({ error: "cashBalance must be a non-negative number" }, { status: 400 });
    }
    const settings = await prisma.portfolioSettings.upsert({
      where: { id: "default" },
      update: { cashBalance },
      create: { id: "default", cashBalance },
    });
    return NextResponse.json(settings);
  } catch (err) {
    console.error("[settings PATCH]", err);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
