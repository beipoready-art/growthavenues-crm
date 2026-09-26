/* eslint-disable no-console */
import { PrismaClient, type ClientType, type KycStatus, type LeadSource, type LeadStatus, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PASSWORD = "Password@123";

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

async function main() {
  console.log("Resetting data…");
  await prisma.auditLog.deleteMany();
  await prisma.kycStatusChange.deleteMany();
  await prisma.document.deleteMany();
  await prisma.client.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const mkUser = (name: string, email: string, role: Role, active = true) =>
    prisma.user.create({ data: { name, email, role, active, passwordHash } });

  const admin = await mkUser("Aarti Mehta", "admin@growthavenues.in", "ADMIN");
  const compliance = await mkUser("Vikram Rao", "compliance@growthavenues.in", "COMPLIANCE");
  const rm1 = await mkUser("Rohan Sharma", "rohan@growthavenues.in", "RM");
  const rm2 = await mkUser("Priya Nair", "priya@growthavenues.in", "RM");
  await mkUser("Kabir Singh", "viewer@growthavenues.in", "VIEWER");
  await mkUser("Neha Gupta", "neha@growthavenues.in", "VIEWER", false); // pending self-signup

  const leads: { name: string; phone: string; email?: string; source: LeadSource; status: LeadStatus; rm: string | null; age: number }[] = [
    { name: "Ankit Verma", phone: "+91 98200 11223", email: "ankit.verma@gmail.com", source: "REFERRAL", status: "NEW", rm: rm1.id, age: 1 },
    { name: "Sneha Kulkarni", phone: "+91 98111 45678", email: "sneha.k@outlook.com", source: "WEBSITE", status: "CONTACTED", rm: rm1.id, age: 4 },
    { name: "Rajesh Iyer", phone: "+91 99870 33445", source: "CALL_IN", status: "QUALIFIED", rm: rm2.id, age: 7 },
    { name: "Meera Joshi", phone: "+91 90040 99881", email: "meera.joshi@yahoo.com", source: "WEBSITE", status: "LOST", rm: rm2.id, age: 20 },
    { name: "Farhan Qureshi", phone: "+91 97690 12121", email: "farhan.q@gmail.com", source: "OTHER", status: "NEW", rm: null, age: 0 },
    { name: "Divya Menon", phone: "+91 98450 67676", source: "REFERRAL", status: "CONTACTED", rm: rm2.id, age: 3 },
  ];
  for (const l of leads) {
    await prisma.lead.create({
      data: {
        name: l.name,
        phone: l.phone,
        email: l.email,
        source: l.source,
        status: l.status,
        assignedRmId: l.rm,
        createdById: admin.id,
        createdAt: daysAgo(l.age),
      },
    });
  }

  // Converted leads → clients, with KYC at various stages.
  const clients: {
    name: string; phone: string; email?: string; source: LeadSource; pan: string; type: ClientType;
    kyc: KycStatus; rm: string; age: number;
  }[] = [
    { name: "Suresh Patel", phone: "+91 98250 55001", email: "suresh.patel@gmail.com", source: "REFERRAL", pan: "ABCPP1234K", type: "INDIVIDUAL", kyc: "VERIFIED", rm: rm1.id, age: 30 },
    { name: "Patel Family HUF", phone: "+91 98250 55002", source: "REFERRAL", pan: "AAAHP5678L", type: "HUF", kyc: "SUBMITTED", rm: rm1.id, age: 14 },
    { name: "Nimbus Tech Pvt Ltd", phone: "+91 22 4000 1234", email: "accounts@nimbustech.in", source: "WEBSITE", pan: "AADCN9012M", type: "CORPORATE", kyc: "UNDER_REVIEW", rm: rm2.id, age: 10 },
    { name: "Kavita Reddy", phone: "+91 99000 22110", email: "kavita.r@gmail.com", source: "CALL_IN", pan: "BCDPR3456N", type: "INDIVIDUAL", kyc: "PENDING", rm: rm2.id, age: 5 },
  ];
  // KYC path each seeded status went through (audit trail).
  const path: Record<KycStatus, KycStatus[]> = {
    PENDING: [],
    SUBMITTED: ["SUBMITTED"],
    UNDER_REVIEW: ["SUBMITTED", "UNDER_REVIEW"],
    VERIFIED: ["SUBMITTED", "UNDER_REVIEW", "VERIFIED"],
    REJECTED: ["SUBMITTED", "UNDER_REVIEW", "REJECTED"],
  };
  for (const c of clients) {
    const lead = await prisma.lead.create({
      data: {
        name: c.name, phone: c.phone, email: c.email, source: c.source, status: "CONVERTED",
        assignedRmId: c.rm, createdById: admin.id, createdAt: daysAgo(c.age + 7), convertedAt: daysAgo(c.age),
      },
    });
    const client = await prisma.client.create({
      data: {
        name: c.name, phone: c.phone, email: c.email, source: c.source, panNumber: c.pan, clientType: c.type,
        kycStatus: c.kyc, assignedRmId: c.rm, leadId: lead.id, createdAt: daysAgo(c.age),
      },
    });
    let from: KycStatus = "PENDING";
    const steps = path[c.kyc];
    for (const [i, to] of steps.entries()) {
      await prisma.kycStatusChange.create({
        data: {
          clientId: client.id, fromStatus: from, toStatus: to,
          changedById: to === "SUBMITTED" ? c.rm : compliance.id,
          note: to === "VERIFIED" ? "All documents verified against originals" : null,
          createdAt: daysAgo(c.age - i - 1),
        },
      });
      from = to;
    }
    await prisma.auditLog.create({
      data: { entityType: "Lead", entityId: lead.id, action: "converted", userId: c.rm, metadata: { clientId: client.id }, createdAt: daysAgo(c.age) },
    });
  }

  console.log(`Seeded. All users share the password: ${PASSWORD}`);
  console.table([
    { role: "Admin", email: admin.email },
    { role: "Compliance", email: compliance.email },
    { role: "RM", email: rm1.email },
    { role: "RM", email: rm2.email },
    { role: "Viewer", email: "viewer@growthavenues.in" },
  ]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
