import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-4 text-center">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-400">403</p>
      <h1 className="text-lg font-semibold">You don&apos;t have access to this page</h1>
      <p className="text-sm text-gray-500">Ask an administrator if you think this is a mistake.</p>
      <Link href="/" className="mt-3 text-sm font-medium text-brand-600 hover:underline">
        Back to dashboard
      </Link>
    </div>
  );
}
