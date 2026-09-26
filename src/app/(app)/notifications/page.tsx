import Link from "next/link";
import { Card, EmptyState, PageBody, PageHeader } from "@/components/layout";
import type { SearchParams } from "@/lib/filters";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/session";
import { NotificationActions, NotificationRow } from "./notification-row";

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageUser();
  const unreadOnly = (await searchParams).filter === "unread";
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id, ...(unreadOnly ? { readAt: null } : {}) }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  const tab = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium ${active ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`;

  return (
    <>
      <PageHeader title="Notifications" description={`${unread} unread`} actions={<NotificationActions unread={unread} />} />
      <PageBody className="space-y-4">
        <div className="flex gap-1.5">
          <Link href="/notifications" className={tab(!unreadOnly)}>
            All
          </Link>
          <Link href="/notifications?filter=unread" className={tab(unreadOnly)}>
            Unread ({unread})
          </Link>
        </div>
        <Card>
          {items.length === 0 ? (
            <EmptyState title={unreadOnly ? "No unread notifications" : "No notifications yet"} />
          ) : (
            <ul className="divide-y divide-gray-100" data-testid="notifications">
              {items.map((n) => (
                <NotificationRow key={n.id} n={{ ...n, createdAt: n.createdAt.toISOString(), readAt: n.readAt?.toISOString() ?? null }} />
              ))}
            </ul>
          )}
        </Card>
      </PageBody>
    </>
  );
}
