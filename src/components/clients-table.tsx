import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { Card, EmptyState, Table, Td, Th } from "@/components/layout";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui";
import { clientListInclude } from "@/lib/clients";
import type { SearchParams } from "@/lib/filters";
import { formatDate } from "@/lib/format";
import { ENTITY_TYPE_LABELS, KYC_STATUS_LABELS, KYC_STATUS_TONE } from "@/lib/labels";

type ClientRow = Prisma.ClientGetPayload<{ include: typeof clientListInclude }>;

export function ClientsTable({
  clients,
  total,
  page,
  pathname,
  searchParams,
}: {
  clients: ClientRow[];
  total: number;
  page: number;
  pathname: string;
  searchParams: SearchParams;
}) {
  return (
    <Card>
      {clients.length === 0 ? (
        <EmptyState title="No clients found" description="Try adjusting your filters." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Company</Th>
              <Th>Sector</Th>
              <Th>City</Th>
              <Th>Entity</Th>
              <Th className="text-right">Mandates</Th>
              <Th>KYC</Th>
              <Th>Assigned RM</Th>
              <Th>Client since</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {clients.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50/60">
                <Td>
                  <Link href={`/clients/${c.id}`} className="font-medium text-gray-900 hover:text-brand-600">
                    {c.name}
                  </Link>
                  {c.contacts[0] && (
                    <div className="text-xs text-gray-500">
                      {c.contacts[0].name}
                      {c.contacts[0].designation && `, ${c.contacts[0].designation}`}
                    </div>
                  )}
                </Td>
                <Td>{c.sector ?? "—"}</Td>
                <Td>{c.city ?? "—"}</Td>
                <Td>{ENTITY_TYPE_LABELS[c.entityType]}</Td>
                <Td className="text-right tabular-nums">{c._count.mandates}</Td>
                <Td>
                  <Badge tone={KYC_STATUS_TONE[c.kycStatus]}>{KYC_STATUS_LABELS[c.kycStatus]}</Badge>
                </Td>
                <Td>{c.assignedRm?.name ?? <span className="text-gray-400">Unassigned</span>}</Td>
                <Td>{formatDate(c.createdAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination total={total} page={page} pathname={pathname} searchParams={searchParams} />
    </Card>
  );
}
