import { PageBody, PageHeader } from "@/components/layout";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/session";
import { userSelect } from "@/lib/users";
import { UsersTable } from "./users-table";

export default async function UsersPage() {
  const me = await requirePageUser("users:manage");
  const users = await prisma.user.findMany({ select: userSelect, orderBy: [{ active: "asc" }, { name: "asc" }] });
  const pending = users.filter((u) => !u.active).length;

  return (
    <>
      <PageHeader
        title="Users"
        description={`${users.length} users${pending ? ` · ${pending} awaiting activation` : ""}`}
      />
      <PageBody>
        <UsersTable users={users.map((u) => ({ ...u, lastLoginAt: u.lastLoginAt?.toISOString() ?? null, createdAt: u.createdAt.toISOString() }))} currentUserId={me.id} />
      </PageBody>
    </>
  );
}
