import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ registered?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { registered } = await searchParams;
  return <LoginForm registered={registered} />;
}
