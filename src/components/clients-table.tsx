import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { Card, EmptyState, Table, Td, Th } from "@/components/layout";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui";
import { clientListInclude } from "@/lib/clients";
import type { SearchParams } from "@/lib/filters";
import { formatDate } from "@/lib/format";
import { CLIENT_TYPE_LABELS, KYC_STATUS_LABELS, KYC_STATUS_TONE } from "@/lib/labels";

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
              <Th>Name</Th>
              <Th>Phone</Th>
              <Th>Email</Th>
              <Th>PAN</Th>
              <Th>Type</Th>
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
                </Td>
                <Td>{c.phone}</Td>
                <Td className="text-gray-500">{c.email ?? "—"}</Td>
                <Td className="font-mono text-xs">{c.panNumber ?? "—"}</Td>
                <Td>{CLIENT_TYPE_LABELS[c.clientType]}</Td>
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
