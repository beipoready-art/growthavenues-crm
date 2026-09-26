import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { handle, requireApiUser } from "@/lib/session";
import { userSelect } from "@/lib/users";
import { emailSchema, nameSchema, passwordSchema } from "@/lib/validation";

export async function GET() {
  return handle(async () => {
    await requireApiUser("users:manage");
    const users = await prisma.user.findMany({ select: userSelect, orderBy: [{ active: "asc" }, { name: "asc" }] });
    return NextResponse.json({ users });
  });
}

const createSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(["ADMIN", "COMPLIANCE", "RM", "VIEWER"]),
});

export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireApiUser("users:manage");
    const input = createSchema.parse(await req.json());
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          role: input.role,
          passwordHash: await hashPassword(input.password),
          active: true,
        },
        select: userSelect,
      });
      await audit(tx, { entityType: "User", entityId: created.id, action: "created", userId: admin.id, metadata: { role: input.role } });
      return created;
    });
    return NextResponse.json({ user }, { status: 201 });
  });
}
