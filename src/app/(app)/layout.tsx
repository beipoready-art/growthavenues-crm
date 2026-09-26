import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { syncNotificationsForUser, unreadCount } from "@/lib/notifications";
import { can } from "@/lib/rbac";
import { requirePageUser } from "@/lib/session";
import { dueTaskCount } from "@/lib/tasks";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  // Generate any due reminders for this user before counting unread.
  await syncNotificationsForUser(user.id);
  const [dueTasks, unread] = await Promise.all([can(user.role, "tasks:manage") ? dueTaskCount(user.id) : 0, unreadCount(user.id)]);
  return (
    <div className="min-h-screen">
      <Sidebar user={user} badges={{ "/tasks": dueTasks }} />
      <main className="pl-60">
        <TopBar unread={unread} />
        {children}
      </main>
    </div>
  );
}
