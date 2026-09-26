import { z } from "zod";
import { assertCanAccessParent } from "@/lib/interactions";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { HttpError, type CurrentUser } from "@/lib/session";
import { nameSchema, optionalEmail, optionalText } from "@/lib/validation";

const fields = {
  name: nameSchema,
  designation: optionalText(100),
  email: optionalEmail,
  phone: optionalText(40),
  isPrimary: z.coerce.boolean().optional(),
};
export const contactCreateSchema = z
  .object({ ...fields, clientId: z.string().optional().nullable(), leadId: z.string().optional().nullable() })
  .refine((v) => !!v.clientId !== !!v.leadId, "Add the contact to a client or a lead");
export const contactUpdateSchema = z.object(fields).partial();

/** Contacts are edited by whoever may edit the parent lead/client. */
export async function assertCanEditParent(user: CurrentUser, parent: { clientId?: string | null; leadId?: string | null }) {
  if (!can(user.role, parent.clientId ? "clients:edit" : "leads:edit")) throw new HttpError(403, "You do not have permission to edit contacts");
  await assertCanAccessParent(user, parent);
}

/** Keeps a single primary contact per company. */
export async function clearOtherPrimaries(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], parent: { clientId?: string | null; leadId?: string | null }, keepId: string) {
  await tx.contact.updateMany({
    where: { id: { not: keepId }, ...(parent.clientId ? { clientId: parent.clientId } : { leadId: parent.leadId! }) },
    data: { isPrimary: false },
  });
}
