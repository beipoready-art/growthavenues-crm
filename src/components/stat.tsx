import Link from "next/link";
import type { ReactNode } from "react";

export function StatTile({ label, value, hint, href }: { label: string; value: ReactNode; hint?: ReactNode; href?: string }) {
  const body = (
    <div className="h-full rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition-colors hover:border-gray-300">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}
