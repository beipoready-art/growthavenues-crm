import clsx from "clsx";
import Link from "next/link";
import { FilterBar } from "@/components/filter-bar";
import { Card, EmptyState, PageBody, PageHeader, Table, Td, Th } from "@/components/layout";
import { NewMandateButton } from "@/components/mandate-form";
import { StageProgress } from "@/components/mandate-list";
import { Badge } from "@/components/ui";
import { param, type SearchParams } from "@/lib/filters";
import { formatDate, formatINR, formatINRCompact } from "@/lib/format";
import { MANDATE_STAGE_LABELS, mandateStageTone, options, SERVICE_LABELS, SERVICE_SHORT_LABELS } from "@/lib/labels";
import { BOARD_COLUMNS, mandateInclude, mandateWhere } from "@/lib/mandates";
import { prisma } from "@/lib/prisma";
import { can, ownedScope } from "@/lib/rbac";
import { requirePageUser } from "@/lib/session";
import { advisorOptions } from "@/lib/users";

export default async function MandatesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageUser("mandates:view");
  const sp = await searchParams;
  const view = param(sp, "view") === "list" ? "list" : "board";
  const status = param(sp, "status") ?? "active";
  const [mandates, advisors, clients] = await Promise.all([
    prisma.mandate.findMany({ where: mandateWhere(user, sp), include: mandateInclude, orderBy: [{ targetDate: "asc" }, { code: "asc" }] }),
    advisorOptions(),
    can(user.role, "mandates:manage") ? prisma.client.findMany({ where: ownedScope(user), select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  const totalFee = mandates.reduce((s, m) => s + Number(m.expectedFee ?? 0), 0);
  const qs = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string"));
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const s = next.toString();
    return s ? `/mandates?${s}` : "/mandates";
  };
  const tab = (active: boolean) => clsx("rounded px-3 py-1 text-sm", active ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50");

  return (
    <>
      <PageHeader
        title="Mandates"
        description={`${mandates.length} mandate${mandates.length === 1 ? "" : "s"} · ${formatINRCompact(totalFee)} expected fees`}
        actions={
          <>
            <a href="/api/reports/mandates" className="inline-flex h-9 items-center rounded-md border border-gray-200 bg-white px-3.5 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50">
              Export CSV
            </a>
            {can(user.role, "mandates:manage") && (
              <NewMandateButton size="md" advisors={advisors} clients={clients.map((c) => ({ value: c.id, label: c.name }))} />
            )}
          </>
        }
      />
      <PageBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterBar
            searchPlaceholder="Search client, title, code…"
            filters={[
              { type: "select", key: "service", label: "Services", options: options(SERVICE_LABELS) },
              ...(user.role === "RM" ? [] : [{ type: "select" as const, key: "advisor", label: "Advisors", allLabel: "All advisors", options: advisors }]),
            ]}
          />
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5 shadow-sm" role="group" aria-label="Mandate status">
              {[
                ["active", "Active"],
                ["won", "Won"],
                ["paused", "On hold / dropped"],
                ["all", "All"],
              ].map(([k, label]) => (
                <Link key={k} href={qs({ status: k === "active" ? null : k })} className={tab(status === k)} aria-pressed={status === k}>
                  {label}
                </Link>
              ))}
            </div>
            <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5 shadow-sm" role="group" aria-label="View">
              <Link href={qs({ view: null })} className={tab(view === "board")}>
                Board
              </Link>
              <Link href={qs({ view: "list" })} className={tab(view === "list")}>
                List
              </Link>
            </div>
          </div>
        </div>

        {view === "board" ? (
          <div className="flex gap-3 overflow-x-auto pb-2" data-testid="board">
            {[...BOARD_COLUMNS, { key: "paused", label: "On hold / dropped", stages: ["ON_HOLD", "DROPPED"] as const }].map((col) => {
              const items = mandates.filter((m) => (col.stages as readonly string[]).includes(m.stage));
              if (!items.length && (col.key === "paused" || col.key === "won") && status === "active") return null;
              const fee = items.reduce((s, m) => s + Number(m.expectedFee ?? 0), 0);
              return (
                <section key={col.key} className="flex w-72 shrink-0 flex-col rounded-xl bg-gray-100/70" data-testid={`column-${col.key}`}>
                  <header className="flex items-baseline justify-between px-3 py-2.5">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                      {col.label} <span className="font-normal text-gray-400">{items.length}</span>
                    </h2>
                    {fee > 0 && <span className="text-xs tabular-nums text-gray-500">{formatINRCompact(fee)}</span>}
                  </header>
                  <div className="flex-1 space-y-2 px-2 pb-2">
                    {items.map((m) => (
                      <Link
                        key={m.id}
                        href={`/mandates/${m.id}`}
                        className="block rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-colors hover:border-brand-500"
                        data-testid="mandate-card"
                      >
                        <p className="flex items-center justify-between text-[11px] text-gray-400">
                          <span className="font-mono">{m.code}</span>
                          <span>{SERVICE_SHORT_LABELS[m.service]}</span>
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-gray-900">{m.client.name}</p>
                        <p className="truncate text-xs text-gray-500">{m.title}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <Badge tone={mandateStageTone(m.stage)}>{MANDATE_STAGE_LABELS[m.stage]}</Badge>
                          {m.expectedFee != null && <span className="text-xs tabular-nums text-gray-600">{formatINRCompact(Number(m.expectedFee))}</span>}
                        </div>
                        <div className="mt-2">
                          <StageProgress service={m.service} stage={m.stage} />
                        </div>
                        <p className="mt-1.5 flex justify-between text-[11px] text-gray-400">
                          <span>{m.leadAdvisor?.name ?? "No advisor"}</span>
                          {m.targetDate && <span>Target {formatDate(m.targetDate)}</span>}
                        </p>
                      </Link>
                    ))}
                    {items.length === 0 && <p className="px-2 py-6 text-center text-xs text-gray-400">No mandates</p>}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <Card>
            {mandates.length === 0 ? (
              <EmptyState title="No mandates" description="Try another filter or create one from a client." />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Mandate</Th>
                    <Th>Client</Th>
                    <Th>Service</Th>
                    <Th>Stage</Th>
                    <Th className="text-right">Size</Th>
                    <Th className="text-right">Expected fee</Th>
                    <Th>Target</Th>
                    <Th>Lead advisor</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100" data-testid="mandate-table">
                  {mandates.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50/60">
                      <Td>
                        <Link href={`/mandates/${m.id}`} className="font-medium text-gray-900 hover:text-brand-600">
                          {m.title}
                        </Link>
                        <div className="font-mono text-[11px] text-gray-400">{m.code}</div>
                      </Td>
                      <Td>
                        <Link href={`/clients/${m.client.id}`} className="hover:text-brand-600">
                          {m.client.name}
                        </Link>
                      </Td>
                      <Td>{SERVICE_SHORT_LABELS[m.service]}</Td>
                      <Td>
                        <Badge tone={mandateStageTone(m.stage)}>{MANDATE_STAGE_LABELS[m.stage]}</Badge>
                      </Td>
                      <Td className="text-right tabular-nums">{m.issueSizeCr != null ? `₹${Number(m.issueSizeCr)} Cr` : "—"}</Td>
                      <Td className="text-right tabular-nums">{formatINR(m.expectedFee)}</Td>
                      <Td>{formatDate(m.targetDate)}</Td>
                      <Td>{m.leadAdvisor?.name ?? "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        )}
      </PageBody>
    </>
  );
}
