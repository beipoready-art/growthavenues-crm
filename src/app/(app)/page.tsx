import { PageBody, PageHeader, Card } from "@/components/layout";
import { ROLE_LABELS } from "@/lib/labels";
import { requirePageUser } from "@/lib/session";

// Placeholder — the role-aware dashboard is built in module 4.
export default async function DashboardPage() {
  const user = await requirePageUser();
  return (
    <>
      <PageHeader title="Dashboard" description={`Signed in as ${user.name} · ${ROLE_LABELS[user.role]}`} />
      <PageBody>
        <Card className="p-6">
          <p className="text-sm text-gray-600">Welcome to GrowthAvenues CRM. Dashboard metrics arrive in a later module.</p>
        </Card>
      </PageBody>
    </>
  );
}
