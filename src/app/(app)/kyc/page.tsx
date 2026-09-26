import { ClientsTable } from "@/components/clients-table";
import { PageBody, PageHeader } from "@/components/layout";
import { clientListInclude, clientWhere } from "@/lib/clients";
import { PAGE_SIZE, pageParam, type SearchParams } from "@/lib/filters";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/session";

/** Compliance work queue: every client whose KYC is waiting on a reviewer. */
export default async function KycQueuePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageUser("clients:view");
  const sp = await searchParams;
  const where = clientWhere(user, { ...sp, kyc: "queue" });
  const page = pageParam(sp);
  const [total, clients] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({ where, include: clientListInclude, orderBy: { updatedAt: "asc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  ]);
  return (
    <>
      <PageHeader title="KYC queue" description="Clients with KYC submitted or under review, oldest first" />
      <PageBody>
        <ClientsTable clients={clients} total={total} page={page} pathname="/kyc" searchParams={sp} />
      </PageBody>
    </>
  );
}
