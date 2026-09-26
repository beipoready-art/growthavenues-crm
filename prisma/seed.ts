/* eslint-disable no-console */
import { PrismaClient, type ClientType, type KycStatus, type LeadSource, type LeadStatus, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();
const PASSWORD = "Password@123";

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");

/** A tiny one-page PDF so seeded KYC documents can be opened. */
function samplePdf(text: string) {
  const stream = `BT /F1 18 Tf 72 720 Td (${text.replace(/[()\\]/g, "")}) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out);
}

const KYC_DOCS = [
  ["KYC_PAN", "pan-card.pdf", "PAN card"],
  ["KYC_AADHAAR", "aadhaar.pdf", "Aadhaar"],
  ["KYC_BANK_PROOF", "cancelled-cheque.pdf", "Bank proof"],
  ["KYC_PHOTO", "photo.pdf", "Photograph"],
] as const;

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

async function main() {
  console.log("Resetting data…");
  await prisma.auditLog.deleteMany();
  await prisma.ipo.deleteMany();
  await prisma.kycStatusChange.deleteMany();
  await prisma.document.deleteMany();
  await prisma.client.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.user.deleteMany();
  await rm(path.join(UPLOAD_DIR, "clients"), { recursive: true, force: true });

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
  const kycPath: Record<KycStatus, KycStatus[]> = {
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
    await prisma.kycStatusChange.create({
      data: { clientId: client.id, fromStatus: null, toStatus: "PENDING", changedById: c.rm, note: "Client created from lead", createdAt: daysAgo(c.age) },
    });
    if (c.kyc !== "PENDING") {
      for (const [category, fileName, label] of KYC_DOCS) {
        const storageKey = `clients/${client.id}/${randomUUID()}.pdf`;
        const data = samplePdf(`${label} - ${c.name} (sample)`);
        await mkdir(path.join(UPLOAD_DIR, "clients", client.id), { recursive: true });
        await writeFile(path.join(UPLOAD_DIR, storageKey), data);
        await prisma.document.create({
          data: { clientId: client.id, category, fileName, storageKey, mimeType: "application/pdf", sizeBytes: data.length, uploadedById: c.rm, createdAt: daysAgo(c.age) },
        });
      }
    }
    let from: KycStatus = "PENDING";
    const steps = kycPath[c.kyc];
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

  // ─── IPOs ──────────────────────────────────────────────────────────────
  const day = (offset: number) => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + offset);
    return d;
  };
  const ipos = {
    open: await prisma.ipo.create({
      data: {
        companyName: "Sahyadri Renewables Ltd", symbol: "SAHYADRI", exchange: "NSE, BSE",
        priceBandLow: 285, priceBandHigh: 300, lotSize: 50,
        openDate: day(-1), closeDate: day(2), listingDate: day(5), status: "OPEN",
        notes: "Solar EPC player. Fresh issue + OFS. Retail quota 35%.", createdById: admin.id,
      },
    }),
    upcoming: await prisma.ipo.create({
      data: {
        companyName: "Kaveri Fintech Ltd", symbol: "KAVERIFIN", exchange: "NSE, BSE",
        priceBandLow: 142, priceBandHigh: 150, lotSize: 100,
        openDate: day(6), closeDate: day(8), listingDate: day(13), status: "UPCOMING",
        notes: "NBFC focused on MSME lending. RHP filed.", createdById: admin.id,
      },
    }),
    listed: await prisma.ipo.create({
      data: {
        companyName: "Nilgiri Foods Ltd", symbol: "NILGIRI", exchange: "NSE",
        priceBandLow: 410, priceBandHigh: 432, lotSize: 34,
        openDate: day(-20), closeDate: day(-17), listingDate: day(-12), status: "LISTED",
        notes: "Listed at 18% premium.", createdById: admin.id,
      },
    }),
  };

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
