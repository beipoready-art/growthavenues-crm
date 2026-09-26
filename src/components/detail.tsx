import type { ReactNode } from "react";

export function DetailGrid({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 text-sm md:grid-cols-3">
      {items.map((i) => (
        <div key={i.label}>
          <dt className="text-xs text-gray-500">{i.label}</dt>
          <dd className="mt-0.5 text-gray-900">{i.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="text-xs font-medium text-gray-500 hover:text-gray-900">
      ← {children}
    </a>
  );
}
