import { Sidebar } from "@/components/sidebar";
import { can } from "@/lib/rbac";
import { requirePageUser } from "@/lib/session";
import { dueTaskCount } from "@/lib/tasks";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const dueTasks = can(user.role, "tasks:manage") ? await dueTaskCount(user.id) : 0;
  return (
    <div className="min-h-screen">
      <Sidebar user={user} badges={{ "/tasks": dueTasks }} />
      <main className="pl-60">{children}</main>
    </div>
  );
}
