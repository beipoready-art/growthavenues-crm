"use client";

import { Mail, Phone, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, EmptyState } from "@/components/layout";
import { Button, ErrorText, Field, Input, Modal } from "@/components/ui";
import { api } from "@/lib/api-client";

export type ContactRow = { id: string; name: string; designation: string | null; email: string | null; phone: string | null; isPrimary: boolean };

/** People at the company: promoter, CFO, company secretary… */
export function ContactsCard({ parent, contacts, canEdit }: { parent: { clientId?: string; leadId?: string }; contacts: ContactRow[]; canEdit: boolean }) {
  const [editing, setEditing] = useState<ContactRow | "new" | null>(null);
  return (
    <Card
      title={`Contacts (${contacts.length})`}
      actions={
        canEdit && (
          <Button size="sm" variant="secondary" onClick={() => setEditing("new")}>
            + Add contact
          </Button>
        )
      }
    >
      {contacts.length === 0 ? (
        <EmptyState title="No contacts yet" />
      ) : (
        <ul className="divide-y divide-gray-100" data-testid="contacts">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                  {c.name}
                  {c.isPrimary && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-gold-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-600">
                      <Star size={10} className="fill-current" /> Primary
                    </span>
                  )}
                </p>
                {c.designation && <p className="text-xs text-gray-500">{c.designation}</p>}
                <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-600">
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-brand-600">
                      <Mail size={11} /> {c.email}
                    </a>
                  )}
                  {c.phone && (
                    <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 hover:text-brand-600">
                      <Phone size={11} /> {c.phone}
                    </a>
                  )}
                </p>
              </div>
              {canEdit && (
                <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
                  Edit
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && <ContactModal parent={parent} contact={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function ContactModal({ parent, contact, onClose }: { parent: { clientId?: string; leadId?: string }; contact?: ContactRow; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const body = { name: f.get("name"), designation: f.get("designation"), email: f.get("email"), phone: f.get("phone"), isPrimary: f.get("isPrimary") === "on" };
    try {
      if (contact) await api(`/api/contacts/${contact.id}`, "PATCH", body);
      else await api("/api/contacts", "POST", { ...body, ...parent });
      onClose();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  async function remove() {
    if (!contact || !confirm(`Remove ${contact.name}?`)) return;
    try {
      await api(`/api/contacts/${contact.id}`, "DELETE");
      onClose();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={contact ? `Edit ${contact.name}` : "Add contact"}
      footer={
        <>
          {contact && (
            <Button variant="ghost" className="mr-auto text-red-600" onClick={remove}>
              Remove
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="contact-form" loading={loading}>
            Save
          </Button>
        </>
      }
    >
      <form id="contact-form" onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <ErrorText>{error}</ErrorText>
        </div>
        <Field label="Name" htmlFor="ct-name">
          <Input id="ct-name" name="name" defaultValue={contact?.name} required autoFocus />
        </Field>
        <Field label="Designation" htmlFor="ct-designation">
          <Input id="ct-designation" name="designation" defaultValue={contact?.designation ?? ""} placeholder="CFO, Company Secretary…" />
        </Field>
        <Field label="Email" htmlFor="ct-email">
          <Input id="ct-email" name="email" type="email" defaultValue={contact?.email ?? ""} />
        </Field>
        <Field label="Phone" htmlFor="ct-phone">
          <Input id="ct-phone" name="phone" defaultValue={contact?.phone ?? ""} />
        </Field>
        <label className="col-span-2 flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="isPrimary" defaultChecked={contact?.isPrimary} className="rounded border-gray-300" /> Primary contact
        </label>
      </form>
    </Modal>
  );
}
