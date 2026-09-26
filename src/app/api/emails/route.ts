import { NextResponse } from "next/server";
import { z } from "zod";
import { localMessageId } from "@/lib/email-sync";
import { assertCanAccessParent } from "@/lib/interactions";
import { sendMail } from "@/lib/integrations/mail";
import { IntegrationError } from "@/lib/integrations/oauth";
import { prisma } from "@/lib/prisma";
import { handle, HttpError, requireApiUser } from "@/lib/session";

const emails = z.array(z.string().trim().toLowerCase().email("Invalid email address")).max(30);
const sendSchema = z
  .object({
    to: emails.min(1, "Add at least one recipient"),
    cc: emails.default([]),
    subject: z.string().trim().min(1, "Subject is required").max(300),
    body: z.string().trim().min(1, "Write a message").max(20000),
    provider: z.enum(["GOOGLE", "MICROSOFT"]).optional(),
    leadId: z.string().optional().nullable().transform((v) => v || null),
    clientId: z.string().optional().nullable().transform((v) => v || null),
  })
  .refine((v) => !!v.leadId !== !!v.clientId, "Send from a lead or client page");

/** Email thread list for a lead/client. */
export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireApiUser("leads:view");
    const sp = new URL(req.url).searchParams;
    const leadId = sp.get("leadId");
    const clientId = sp.get("clientId");
    await assertCanAccessParent(user, { leadId, clientId });
    const messages = await prisma.emailMessage.findMany({
      where: clientId ? { clientId } : { leadId },
      include: { user: { select: { name: true } } },
      orderBy: { sentAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ messages });
  });
}

/** Send an email from the user's connected mailbox; it's stored on the record's timeline immediately. */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireApiUser("emails:send");
    const input = sendSchema.parse(await req.json());
    await assertCanAccessParent(user, input);
    const accounts = await prisma.connectedAccount.findMany({ where: { userId: user.id } });
    const account = input.provider ? accounts.find((a) => a.provider === input.provider) : accounts[0];
    if (!account) throw new HttpError(400, "Connect your Gmail or Outlook account under My account to send email from the CRM");

    let sent;
    try {
      sent = await sendMail(account, { to: input.to, cc: input.cc, subject: input.subject, body: input.body });
    } catch (err) {
      if (err instanceof IntegrationError) throw new HttpError(502, `Email: ${err.message}`);
      throw err;
    }
    const message = await prisma.emailMessage.create({
      data: {
        accountId: account.id,
        provider: account.provider,
        externalId: sent.externalId ?? localMessageId(),
        threadId: sent.threadId,
        subject: input.subject,
        snippet: input.body.slice(0, 200),
        bodyText: input.body,
        fromEmail: account.email,
        fromName: user.name,
        toEmails: input.to,
        ccEmails: input.cc,
        sentAt: new Date(),
        direction: "OUTBOUND",
        userId: user.id,
        clientId: input.clientId,
        leadId: input.leadId,
      },
    });
    return NextResponse.json({ message }, { status: 201 });
  });
}
