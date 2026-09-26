"use client";

/* eslint-disable @next/next/no-img-element -- previews of our own logo / local file */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ErrorText, Field, Input, Textarea } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { CompanyProfileView } from "@/lib/company";

export function CompanyForm({ company }: { company: CompanyProfileView }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(company.logoUrl);
  const [removeLogo, setRemoveLogo] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);
    const form = new FormData(e.currentTarget);
    if (removeLogo) form.set("removeLogo", "1");
    try {
      await api("/api/settings/company", "PUT", form);
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-2 gap-4 px-5 py-5">
      <div className="col-span-2">
        <ErrorText>{error}</ErrorText>
        {saved && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Saved. The header now shows the updated details.</p>}
      </div>
      <div className="col-span-2 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          {preview && !removeLogo ? <img src={preview} alt="Logo preview" className="h-full w-full object-contain" /> : <span className="text-xs text-gray-400">No logo</span>}
        </div>
        <div className="space-y-1.5">
          <Input
            name="logo"
            type="file"
            aria-label="Logo"
            accept="image/png,image/jpeg,image/webp"
            className="py-1.5"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setRemoveLogo(false);
              if (f) setPreview(URL.createObjectURL(f));
            }}
          />
          <p className="text-xs text-gray-500">PNG, JPG or WEBP, up to 1 MB. Square works best.</p>
          {company.logoUrl && !removeLogo && (
            <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => setRemoveLogo(true)}>
              Remove logo
            </button>
          )}
        </div>
      </div>
      <div className="col-span-2">
        <Field label="Firm name" htmlFor="cp-name">
          <Input id="cp-name" name="firmName" defaultValue={company.firmName} required />
        </Field>
      </div>
      <div className="col-span-2">
        <Field label="Tagline" htmlFor="cp-tagline" hint="Shown in the header and on the sign-in page.">
          <Input id="cp-tagline" name="tagline" defaultValue={company.tagline ?? ""} placeholder="Stock broking & IPO advisory" />
        </Field>
      </div>
      <Field label="Phone" htmlFor="cp-phone">
        <Input id="cp-phone" name="phone" defaultValue={company.phone ?? ""} />
      </Field>
      <Field label="Email" htmlFor="cp-email">
        <Input id="cp-email" name="email" type="email" defaultValue={company.email ?? ""} />
      </Field>
      <Field label="Website" htmlFor="cp-website">
        <Input id="cp-website" name="website" type="url" defaultValue={company.website ?? ""} placeholder="https://" />
      </Field>
      <Field label="SEBI registration no." htmlFor="cp-sebi">
        <Input id="cp-sebi" name="sebiRegistration" defaultValue={company.sebiRegistration ?? ""} />
      </Field>
      <div className="col-span-2">
        <Field label="Address" htmlFor="cp-address">
          <Textarea id="cp-address" name="address" defaultValue={company.address ?? ""} rows={2} />
        </Field>
      </div>
      <div className="col-span-2 flex justify-end">
        <Button type="submit" loading={loading}>
          Save profile
        </Button>
      </div>
    </form>
  );
}
