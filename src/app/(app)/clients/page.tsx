import { ClientsTable } from "@/components/clients-table";
import { FilterBar } from "@/components/filter-bar";
import { PageBody, PageHeader } from "@/components/layout";
import { clientListInclude, clientWhere } from "@/lib/clients";
import { PAGE_SIZE, pageParam, type SearchParams } from "@/lib/filters";
import { ENTITY_TYPE_LABELS, KYC_STATUS_LABELS, options } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { isScopedToOwn } from "@/lib/rbac";
import { requirePageUser } from "@/lib/session";
import { listRms } from "@/lib/users";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageUser("clients:view");
  const sp = await searchParams;
  const where = clientWhere(user, sp);
  const page = pageParam(sp);
  const [total, clients, rms] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({ where, include: clientListInclude, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    listRms(),
  ]);
  const scoped = isScopedToOwn(user.role);

  return (
    <>
      <PageHeader
        title="Clients"
        description={scoped ? "Client companies assigned to you" : "Companies we advise"}
        actions={
          <a
            href={`/api/reports/clients?${new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string")).toString()}`}
            className="inline-flex h-9 items-center rounded-md border border-gray-200 bg-white px-3.5 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
          >
            Export CSV
          </a>
        }
      />
      <PageBody className="space-y-4">
        <FilterBar
          searchPlaceholder="Search company, contact, sector, CIN, PAN…"
          filters={[
            { type: "select", key: "kyc", label: "KYC statuses", options: options(KYC_STATUS_LABELS) },
            { type: "select", key: "type", label: "Entity types", options: options(ENTITY_TYPE_LABELS) },
            ...(scoped
              ? []
              : [{ type: "select" as const, key: "rm", label: "RMs", allLabel: "All RMs", options: [{ value: "unassigned", label: "Unassigned" }, ...rms.map((r) => ({ value: r.id, label: r.name }))] }]),
            { type: "dateRange", label: "Client since" },
          ]}
        />
        <ClientsTable clients={clients} total={total} page={page} pathname="/clients" searchParams={sp} />
      </PageBody>
    </>
  );
}
