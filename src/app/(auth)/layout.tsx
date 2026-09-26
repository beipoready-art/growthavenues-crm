import { Logo } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <Logo className="mb-6" />
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-sm">{children}</div>
      <p className="mt-6 text-xs text-gray-400">Stock broking & IPO advisory CRM</p>
    </div>
  );
}
