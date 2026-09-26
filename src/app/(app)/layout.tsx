import { Sidebar } from "@/components/sidebar";
import { requirePageUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  return (
    <div className="min-h-screen">
      <Sidebar user={user} />
      <main className="pl-60">{children}</main>
    </div>
  );
}
