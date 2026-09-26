import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, diff } from "@/lib/audit";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { handle, HttpError, requireApiUser } from "@/lib/session";
import { nameSchema, passwordSchema } from "@/lib/validation";
import { userSelect } from "@/lib/users";

const patchSchema = z.object({
  name: nameSchema.optional(),
  role: z.enum(["ADMIN", "COMPLIANCE", "RM", "VIEWER"]).optional(),
  active: z.boolean().optional(),
  password: passwordSchema.optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireApiUser("users:manage");
    const { id } = await params;
    const input = patchSchema.parse(await req.json());

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "User not found");

    // Guard against an admin locking themselves out.
    if (id === admin.id && (input.active === false || (input.role && input.role !== "ADMIN"))) {
      throw new HttpError(400, "You cannot deactivate or change the role of your own account");
    }

    const { password, ...fields } = input;
    const changes = diff(existing, fields);
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { ...fields, ...(password ? { passwordHash: await hashPassword(password) } : {}) },
        select: userSelect,
      });
      await audit(tx, {
        entityType: "User",
        entityId: id,
        action: "updated",
        userId: admin.id,
        metadata: { ...changes, ...(password ? { password: "reset" } : {}) },
      });
      return updated;
    });
    return NextResponse.json({ user });
  });
}
