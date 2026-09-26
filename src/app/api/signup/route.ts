import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { handle } from "@/lib/session";
import { emailSchema, nameSchema, passwordSchema } from "@/lib/validation";

const schema = z.object({ name: nameSchema, email: emailSchema, password: passwordSchema });

/**
 * Public self-signup.
 * - The very first user becomes an active Admin (bootstraps a fresh install).
 * - Everyone after that is created as an inactive Viewer; an Admin must
 *   activate them and assign a role on the Users page.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const input = schema.parse(await req.json());
    const bootstrapAdmin = (await prisma.user.count()) === 0;
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: await hashPassword(input.password),
        role: bootstrapAdmin ? "ADMIN" : "VIEWER",
        active: bootstrapAdmin,
      },
    });
    await prisma.auditLog.create({
      data: { entityType: "User", entityId: user.id, action: "signed_up", userId: user.id },
    });
    return NextResponse.json({ ok: true, bootstrapAdmin }, { status: 201 });
  });
}
