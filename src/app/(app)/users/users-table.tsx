"use client";

import type { Role } from "@prisma/client";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, EmptyState, Table, Td, Th } from "@/components/layout";
import { Badge, Button, ErrorText, Field, Input, Modal, Select } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/format";
import { options, ROLE_LABELS, ROLE_TONE } from "@/lib/labels";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

const roleOptions = options(ROLE_LABELS);

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export function UsersTable({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);

  async function toggleActive(u: UserRow) {
    try {
      await send(`/api/users/${u.id}`, "PATCH", { active: !u.active });
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <>
      <Card
        title="Team members"
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus size={14} /> New user
          </Button>
        }
      >
        {users.length === 0 ? (
          <EmptyState title="No users yet" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Last login</Th>
                <Th>Created</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/60">
                  <Td>
                    <div className="font-medium text-gray-900">
                      {u.name} {u.id === currentUserId && <span className="text-xs font-normal text-gray-400">(you)</span>}
                    </div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </Td>
                  <Td>
                    <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABELS[u.role]}</Badge>
                  </Td>
                  <Td>{u.active ? <Badge tone="green">Active</Badge> : <Badge tone="amber">Inactive</Badge>}</Td>
                  <Td>{formatDateTime(u.lastLoginAt)}</Td>
                  <Td>{formatDate(u.createdAt)}</Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(u)}>
                        Edit
                      </Button>
                      {u.id !== currentUserId && (
                        <Button size="sm" variant={u.active ? "ghost" : "secondary"} onClick={() => toggleActive(u)}>
                          {u.active ? "Deactivate" : "Activate"}
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <CreateUserModal open={creating} onClose={() => setCreating(false)} onDone={() => router.refresh()} />
      {editing && (
        <EditUserModal
          user={editing}
          isSelf={editing.id === currentUserId}
          onClose={() => setEditing(null)}
          onDone={() => router.refresh()}
        />
      )}
    </>
  );
}

function CreateUserModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await send("/api/users", "POST", Object.fromEntries(new FormData(e.currentTarget)));
      onDone();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New user"
      description="The user can sign in immediately with this password."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-user" loading={loading}>
            Create user
          </Button>
        </>
      }
    >
      <form id="create-user" onSubmit={onSubmit} className="space-y-3">
        <ErrorText>{error}</ErrorText>
        <Field label="Full name" htmlFor="cu-name">
          <Input id="cu-name" name="name" required />
        </Field>
        <Field label="Email" htmlFor="cu-email">
          <Input id="cu-email" name="email" type="email" required />
        </Field>
        <Field label="Role" htmlFor="cu-role">
          <Select id="cu-role" name="role" options={roleOptions} defaultValue="RM" />
        </Field>
        <Field label="Temporary password" htmlFor="cu-password" hint="At least 8 characters. Share it securely.">
          <Input id="cu-password" name="password" type="text" minLength={8} required />
        </Field>
      </form>
    </Modal>
  );
}

function EditUserModal({ user, isSelf, onClose, onDone }: { user: UserRow; isSelf: boolean; onClose: () => void; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = { name: form.get("name") };
    if (!isSelf) body.role = form.get("role");
    const password = String(form.get("password") ?? "");
    if (password) body.password = password;
    try {
      await send(`/api/users/${user.id}`, "PATCH", body);
      onDone();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${user.name}`}
      description={user.email}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-user" loading={loading}>
            Save changes
          </Button>
        </>
      }
    >
      <form id="edit-user" onSubmit={onSubmit} className="space-y-3">
        <ErrorText>{error}</ErrorText>
        <Field label="Full name" htmlFor="eu-name">
          <Input id="eu-name" name="name" defaultValue={user.name} required />
        </Field>
        <Field label="Role" htmlFor="eu-role" hint={isSelf ? "You cannot change your own role." : undefined}>
          <Select id="eu-role" name="role" options={roleOptions} defaultValue={user.role} disabled={isSelf} />
        </Field>
        <Field label="Reset password" htmlFor="eu-password" hint="Leave blank to keep the current password.">
          <Input id="eu-password" name="password" type="text" minLength={8} />
        </Field>
      </form>
    </Modal>
  );
}
