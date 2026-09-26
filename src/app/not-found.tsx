import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-4 text-center">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-400">404</p>
      <h1 className="text-lg font-semibold">Page not found</h1>
      <Link href="/" className="mt-3 text-sm font-medium text-brand-600 hover:underline">
        Back to dashboard
      </Link>
    </div>
  );
}
