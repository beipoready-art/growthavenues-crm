"use client";

import type { Notification } from "@prisma/client";
import clsx from "clsx";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";

type Item = Omit<Notification, "createdAt" | "readAt"> & { createdAt: string; readAt: string | null };

/** Bell with unread badge and a dropdown of the latest notifications. */
export function NotificationBell({ unread: serverUnread }: { unread: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // The layout (and so the server count) is kept across client navigations,
  // so track the count locally and resync whenever the server sends a new one.
  const [unread, setUnread] = useState(serverUnread);
  useEffect(() => setUnread(serverUnread), [serverUnread]);
  const [items, setItems] = useState<Item[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    api<{ notifications: Item[] }>("/api/notifications?limit=8").then((d) => setItems(d.notifications));
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function openItem(n: Item) {
    if (!n.readAt) {
      await api(`/api/notifications/${n.id}`, "PATCH", { read: true });
      setUnread((c) => Math.max(0, c - 1));
    }
    setOpen(false);
    // push() fetches the destination fresh; a refresh() right after can cancel the navigation.
    if (n.link) router.push(n.link);
    else router.refresh();
  }

  async function readAll() {
    await api("/api/notifications/read-all", "POST");
    setUnread(0);
    setItems((xs) => xs?.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })) ?? null);
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 min-w-[16px] rounded-full bg-red-500 px-1 text-center text-[10px] font-semibold leading-4 text-white" data-testid="unread-badge">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-96 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg" data-testid="notification-menu">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
            <p className="text-sm font-semibold text-gray-900">Notifications</p>
            {unread > 0 && (
              <button onClick={readAll} className="text-xs font-medium text-brand-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto">
            {items === null && <li className="px-4 py-6 text-center text-sm text-gray-400">Loading…</li>}
            {items?.length === 0 && <li className="px-4 py-6 text-center text-sm text-gray-400">You&apos;re all caught up</li>}
            {items?.map((n) => (
              <li key={n.id}>
                <button onClick={() => openItem(n)} className={clsx("flex w-full gap-2.5 px-4 py-3 text-left hover:bg-gray-50", !n.readAt && "bg-brand-50/40")}>
                  <span className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-brand-600")} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-gray-900">{n.title}</span>
                    {n.body && <span className="block truncate text-xs text-gray-500">{n.body}</span>}
                    <span className="block text-[11px] text-gray-400">{formatDateTime(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-gray-100 px-4 py-2.5 text-center text-xs font-medium text-brand-600 hover:bg-gray-50">
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
