"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ErrorText, Field, Input } from "@/components/ui";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Could not create account.");
      return;
    }
    router.push(`/login?registered=${data.bootstrapAdmin ? "admin" : "pending"}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <h1 className="text-base font-semibold">Request access</h1>
        <p className="text-sm text-gray-500">An administrator will activate your account and assign a role.</p>
      </div>
      <ErrorText>{error}</ErrorText>
      <Field label="Full name" htmlFor="name">
        <Input id="name" name="name" required autoFocus />
      </Field>
      <Field label="Work email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 8 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Button type="submit" className="w-full" loading={loading}>
        Create account
      </Button>
      <p className="text-center text-xs text-gray-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
