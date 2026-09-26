import { NotificationBell } from "@/components/notification-bell";

export function TopBar({ unread }: { unread: number }) {
  return (
    <header className="sticky top-0 z-20 flex h-12 items-center justify-end gap-2 border-b border-gray-200 bg-white/90 px-6 backdrop-blur">
      <NotificationBell unread={unread} />
    </header>
  );
}
