/* eslint-disable no-console */
import { PrismaClient, type ClientType, type KycStatus, type LeadSource, type LeadStatus, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { endOfZonedDay } from "../src/lib/tz";

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
  // Interactions are protected by a no-delete trigger; TRUNCATE is the reset path.
  await prisma.$executeRawUnsafe('TRUNCATE "InteractionRevision", "Interaction"');
  await prisma.auditLog.deleteMany();
  await prisma.task.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.ipoInterest.deleteMany();
  await prisma.ipoApplication.deleteMany();
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
    { name: "Arjun Kapoor", phone: "+91 98330 44556", email: "arjun.kapoor@gmail.com", source: "WEBSITE", pan: "CKPPK7788R", type: "INDIVIDUAL", kyc: "VERIFIED", rm: rm2.id, age: 25 },
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
        const docId = randomUUID();
        await prisma.document.create({
          data: { id: docId, groupId: docId, clientId: client.id, category, fileName, storageKey, mimeType: "application/pdf", sizeBytes: data.length, uploadedById: c.rm, createdAt: daysAgo(c.age) },
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

  // Applications for the verified client (Suresh Patel) on the open and listed IPOs.
  const suresh = await prisma.client.findFirstOrThrow({ where: { name: "Suresh Patel" } });
  await prisma.ipoApplication.create({
    data: {
      ipoId: ipos.open.id, clientId: suresh.id, lotsApplied: 2, amount: 2 * 50 * 300,
      applicationDate: day(0), status: "APPLIED", notes: "Retail, UPI mandate accepted", createdById: rm1.id,
    },
  });
  await prisma.ipoApplication.create({
    data: {
      ipoId: ipos.listed.id, clientId: suresh.id, lotsApplied: 3, lotsAllotted: 1, amount: 3 * 34 * 432,
      applicationDate: day(-18), status: "PARTIALLY_ALLOTTED", createdById: rm1.id,
    },
  });
  const arjun = await prisma.client.findFirstOrThrow({ where: { name: "Arjun Kapoor" } });
  await prisma.ipoApplication.create({
    data: {
      ipoId: ipos.listed.id, clientId: arjun.id, lotsApplied: 1, amount: 34 * 432,
      applicationDate: day(-19), status: "REFUNDED", notes: "Not allotted; funds unblocked", createdById: rm2.id,
    },
  });
  void ipos.upcoming;

  // ─── General documents (versioned) ─────────────────────────────────────
  async function seedDoc(clientId: string, category: "CONTRACT_NOTE" | "RISK_DISCLOSURE" | "APPLICATION_FORM", title: string, versions: { fileName: string; age: number; by: string }[]) {
    const groupId = randomUUID();
    for (const [i, v] of versions.entries()) {
      const storageKey = `clients/${clientId}/${randomUUID()}.pdf`;
      const data = samplePdf(`${title} v${i + 1} (sample)`);
      await mkdir(path.join(UPLOAD_DIR, "clients", clientId), { recursive: true });
      await writeFile(path.join(UPLOAD_DIR, storageKey), data);
      await prisma.document.create({
        data: {
          id: i === 0 ? groupId : randomUUID(), groupId, version: i + 1, isLatest: i === versions.length - 1,
          clientId, category, title, fileName: v.fileName, storageKey, mimeType: "application/pdf", sizeBytes: data.length,
          uploadedById: v.by, createdAt: daysAgo(v.age),
        },
      });
    }
  }
  await seedDoc(suresh.id, "RISK_DISCLOSURE", "Risk Disclosure Document (signed)", [{ fileName: "rdd-signed.pdf", age: 29, by: rm1.id }]);
  await seedDoc(suresh.id, "APPLICATION_FORM", "Nilgiri Foods IPO application", [{ fileName: "nilgiri-asba-form.pdf", age: 18, by: rm1.id }]);
  await seedDoc(suresh.id, "CONTRACT_NOTE", "Contract note – Sep 2026", [
    { fileName: "cn-sep-2026.pdf", age: 6, by: rm1.id },
    { fileName: "cn-sep-2026-corrected.pdf", age: 5, by: admin.id },
  ]);

  // ─── History: older leads, conversions and past IPOs (for reports) ─────
  const history: [string, LeadSource, number, "CONVERTED" | "LOST" | "CONTACTED", "rm1" | "rm2"][] = [
    ["Harish Chandra", "REFERRAL", 160, "CONVERTED", "rm1"],
    ["Lakshmi Iyer", "WEBSITE", 150, "LOST", "rm2"],
    ["Gaurav Malhotra", "CALL_IN", 140, "CONTACTED", "rm1"],
    ["Pooja Deshmukh", "REFERRAL", 125, "CONVERTED", "rm2"],
    ["Imran Sheikh", "WEBSITE", 118, "LOST", "rm1"],
    ["Ritu Bansal", "WEBSITE", 100, "CONVERTED", "rm1"],
    ["Sanjay Rathi", "OTHER", 92, "LOST", "rm2"],
    ["Anjali Pillai", "REFERRAL", 85, "CONVERTED", "rm2"],
    ["Deepak Sinha", "CALL_IN", 70, "CONVERTED", "rm1"],
    ["Mohan Krishnan", "WEBSITE", 64, "LOST", "rm2"],
    ["Tanvi Shah", "REFERRAL", 55, "CONVERTED", "rm1"],
    ["Yusuf Ali", "CALL_IN", 45, "CONTACTED", "rm2"],
  ];
  const rmOf = { rm1, rm2 };
  const historicalClients: string[] = [];
  for (const [i, [name, source, age, status, who]] of history.entries()) {
    const rmId = rmOf[who].id;
    const digits = `98${String(20000000 + i * 137911)}`;
    const phone = `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
    const convertedAt = status === "CONVERTED" ? daysAgo(age - 9) : null;
    const lead = await prisma.lead.create({
      data: { name, phone, source, status, assignedRmId: rmId, createdById: admin.id, createdAt: daysAgo(age), convertedAt },
    });
    if (convertedAt) {
      const client = await prisma.client.create({
        data: {
          name, phone, source, clientType: "INDIVIDUAL", kycStatus: "VERIFIED", assignedRmId: rmId, leadId: lead.id, createdAt: convertedAt,
          panNumber: `H${"ABCDEFGHIJKL"[i]}${"PQRST"[i % 5]}P${"MN"[i % 2]}${String(4000 + i * 37).slice(0, 4)}${"XYZ"[i % 3]}`,
        },
      });
      historicalClients.push(client.id);
      await prisma.kycStatusChange.createMany({
        data: [
          { clientId: client.id, fromStatus: null, toStatus: "PENDING", changedById: rmId, createdAt: convertedAt },
          { clientId: client.id, fromStatus: "PENDING", toStatus: "SUBMITTED", changedById: rmId, createdAt: daysAgo(age - 10) },
          { clientId: client.id, fromStatus: "SUBMITTED", toStatus: "UNDER_REVIEW", changedById: compliance.id, createdAt: daysAgo(age - 11) },
          { clientId: client.id, fromStatus: "UNDER_REVIEW", toStatus: "VERIFIED", changedById: compliance.id, createdAt: daysAgo(age - 12) },
        ],
      });
    }
  }
  const pastIpos = [
    { companyName: "Godavari Logistics Ltd", symbol: "GODAVARI", priceBandLow: 198, priceBandHigh: 210, lotSize: 70, open: -110, status: "ALLOTTED" as const },
    { companyName: "Malabar Textiles Ltd", symbol: "MALABAR", priceBandLow: 88, priceBandHigh: 92, lotSize: 160, open: -68, status: "REFUNDED" as const },
  ];
  for (const [k, p] of pastIpos.entries()) {
    const ipo = await prisma.ipo.create({
      data: {
        companyName: p.companyName, symbol: p.symbol, exchange: "NSE, BSE", priceBandLow: p.priceBandLow, priceBandHigh: p.priceBandHigh, lotSize: p.lotSize,
        openDate: day(p.open), closeDate: day(p.open + 3), listingDate: day(p.open + 8), status: "LISTED", createdById: admin.id,
      },
    });
    const applicants = [suresh.id, arjun.id, ...historicalClients.slice(0, 2 + k * 2)];
    for (const [j, clientId] of applicants.entries()) {
      const lots = 1 + ((j + k) % 3);
      const status = j % 3 === 0 ? p.status : j % 3 === 1 ? "REFUNDED" : "ALLOTTED";
      await prisma.ipoApplication.create({
        data: {
          ipoId: ipo.id, clientId, lotsApplied: lots, lotsAllotted: status === "ALLOTTED" ? lots : null,
          amount: lots * p.lotSize * p.priceBandHigh, applicationDate: day(p.open + 1), status, createdAt: day(p.open + 1),
        },
      });
    }
  }

  // ─── Interaction log ────────────────────────────────────────────────────
  const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);
  const leadByName = async (name: string) => prisma.lead.findFirstOrThrow({ where: { name } });
  const sneha = await leadByName("Sneha Kulkarni");
  const rajesh = await leadByName("Rajesh Iyer");
  const sureshLead = await leadByName("Suresh Patel");
  await prisma.interaction.createMany({
    data: [
      { leadId: sneha.id, type: "CALL", occurredAt: hoursAgo(80), summary: "Intro call. Interested in IPO investing; wants details of upcoming issues.", loggedById: rm1.id },
      { leadId: sneha.id, type: "EMAIL", occurredAt: hoursAgo(60), summary: "Sent account opening checklist and brokerage schedule.", loggedById: rm1.id },
      { leadId: rajesh.id, type: "MEETING", occurredAt: hoursAgo(30), summary: "Met at office. Ready to open account; will share PAN and bank details.", loggedById: rm2.id },
      { leadId: sureshLead.id, type: "CALL", occurredAt: daysAgo(35), summary: "Referral from existing client. Discussed demat + IPO advisory.", loggedById: rm1.id },
      { clientId: suresh.id, type: "WHATSAPP", occurredAt: hoursAgo(20), summary: "Shared Sahyadri Renewables IPO note. Client wants 2 lots.", loggedById: rm1.id },
      { clientId: suresh.id, type: "NOTE", occurredAt: hoursAgo(5), summary: "Client confirmed UPI mandate for Sahyadri application.", loggedById: rm1.id },
      { clientId: arjun.id, type: "CALL", occurredAt: hoursAgo(26), summary: "Explained Nilgiri refund timeline; funds unblocked.", loggedById: rm2.id },
    ],
  });
  // One entry corrected by an admin, with its revision preserved.
  const corrected = await prisma.interaction.create({
    data: { clientId: suresh.id, type: "MEETING", occurredAt: daysAgo(10), summary: "Portfolio review. Risk profile: moderate.", loggedById: rm1.id, editedAt: daysAgo(9), editedById: admin.id },
  });
  await prisma.interactionRevision.create({
    data: {
      interactionId: corrected.id, previousType: "MEETING", previousOccurredAt: daysAgo(10),
      previousSummary: "Portfolio review. Risk profile: aggressive.", reason: "RM recorded wrong risk profile; corrected per signed form",
      editedById: admin.id, createdAt: daysAgo(9),
    },
  });

  // ─── Tasks ─────────────────────────────────────────────────────────────
  const now = Date.now();
  const endToday = endOfZonedDay(new Date()).getTime();
  const laterToday = new Date(Math.max(now + 10 * 60 * 1000, Math.min(now + 3 * 60 * 60 * 1000, endToday - 15 * 60 * 1000)));
  const inDays = (n: number, hour = 11) => {
    const d = new Date(endToday + n * 86_400_000 - 86_400_000 + 1); // start of day n days ahead (IST)
    return new Date(d.getTime() + hour * 3_600_000);
  };
  const ankitLead = await leadByName("Ankit Verma");
  await prisma.task.createMany({
    data: [
      { title: "Send KYC checklist to Ankit", leadId: ankitLead.id, dueAt: hoursAgo(20), priority: "HIGH", assignedToId: rm1.id, createdById: rm1.id },
      { title: "Remind Suresh: Sahyadri closes soon", description: "Confirm UPI mandate is approved before cut-off.", clientId: suresh.id, dueAt: laterToday, priority: "HIGH", assignedToId: rm1.id, createdById: rm1.id },
      { title: "Follow up with Sneha on account opening", leadId: sneha.id, dueAt: inDays(2), priority: "MEDIUM", assignedToId: rm1.id, createdById: rm1.id },
      { title: "Quarterly portfolio review call", clientId: suresh.id, dueAt: inDays(9, 15), priority: "LOW", assignedToId: rm1.id, createdById: admin.id },
      { title: "Collect bank proof from Rajesh", leadId: rajesh.id, dueAt: hoursAgo(50), priority: "MEDIUM", assignedToId: rm2.id, createdById: rm2.id },
      { title: "Pitch Kaveri Fintech IPO to Arjun", clientId: arjun.id, dueAt: inDays(1), priority: "HIGH", assignedToId: rm2.id, createdById: rm2.id },
      { title: "Review Patel Family HUF KYC", clientId: (await prisma.client.findFirstOrThrow({ where: { name: "Patel Family HUF" } })).id, dueAt: laterToday, priority: "HIGH", assignedToId: compliance.id, createdById: compliance.id },
    ],
  });
  await prisma.task.create({
    data: { title: "Share Nilgiri allotment status", clientId: suresh.id, dueAt: daysAgo(12), priority: "MEDIUM", status: "DONE", completedAt: daysAgo(12), assignedToId: rm1.id, createdById: rm1.id },
  });

  // ─── IPO interest & notifications ──────────────────────────────────────
  // Ankit (Rohan's, KYC verified in the e2e flow) isn't verified in the seed, so use
  // historical verified clients of Rohan who haven't applied to the open IPO.
  const rohanVerified = await prisma.client.findMany({
    where: { assignedRmId: rm1.id, kycStatus: "VERIFIED", ipoApplications: { none: { ipoId: ipos.open.id } } },
    take: 2,
    orderBy: { name: "asc" },
  });
  for (const c of rohanVerified) {
    await prisma.ipoInterest.create({ data: { ipoId: ipos.open.id, clientId: c.id, createdById: rm1.id, note: "Asked for price band details" } });
  }
  const pattel = await prisma.client.findFirstOrThrow({ where: { name: "Patel Family HUF" } });
  await prisma.notification.createMany({
    data: [
      { userId: compliance.id, type: "KYC_STATUS", title: "KYC submitted: Patel Family HUF", body: "Pending → Submitted by Rohan Sharma", link: `/clients/${pattel.id}`, createdAt: daysAgo(14) },
      { userId: rm1.id, type: "KYC_STATUS", title: "KYC verified: Suresh Patel", body: "Under Review → Verified by Vikram Rao — All documents verified against originals", link: `/clients/${suresh.id}`, createdAt: daysAgo(28), readAt: daysAgo(27) },
      { userId: rm1.id, type: "LEAD_ASSIGNED", title: "New lead assigned: Ankit Verma", body: "Assigned by Aarti Mehta", link: `/leads/${ankitLead.id}`, createdAt: daysAgo(1) },
      { userId: rm2.id, type: "LEAD_ASSIGNED", title: "New lead assigned: Divya Menon", body: "Assigned by Aarti Mehta", link: `/leads/${(await leadByName("Divya Menon")).id}`, createdAt: daysAgo(3) },
    ],
  });

  // ─── Company profile (sample values — edit under Settings) ───────────────
  await prisma.companyProfile.upsert({
    where: { id: 1 },
    create: { id: 1, firmName: "GrowthAvenues", tagline: "Stock Broking & IPO Advisory", phone: "+91 22 4000 5000", email: "support@growthavenues.in", website: "https://growthavenues.in", sebiRegistration: "INZ000000000 (sample)", address: "Mumbai, Maharashtra" },
    update: { firmName: "GrowthAvenues", tagline: "Stock Broking & IPO Advisory", phone: "+91 22 4000 5000", email: "support@growthavenues.in", website: "https://growthavenues.in", sebiRegistration: "INZ000000000 (sample)", address: "Mumbai, Maharashtra", logoKey: null, logoMime: null },
  });

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
