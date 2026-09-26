import { Card, PageBody, PageHeader } from "@/components/layout";
import { getCompanyProfile } from "@/lib/company";
import { requirePageUser } from "@/lib/session";
import { CompanyForm } from "./company-form";

export default async function SettingsPage() {
  await requirePageUser("settings:manage");
  const company = await getCompanyProfile();
  return (
    <>
      <PageHeader title="Settings" description="Company profile shown in the CRM header, sidebar and sign-in page" />
      <PageBody className="max-w-3xl">
        <Card title="Company profile">
          <CompanyForm company={company} />
        </Card>
      </PageBody>
    </>
  );
}
