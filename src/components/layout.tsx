import clsx from "clsx";
import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-200 bg-white px-8 py-5">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("px-8 py-6", className)}>{children}</div>;
}

export function Card({ children, className, title, actions }: { children: ReactNode; className?: string; title?: string; actions?: ReactNode }) {
  return (
    <section className={clsx("rounded-xl border border-gray-200 bg-white shadow-sm", className)}>
      {title && (
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-sm font-medium text-gray-900">{title}</p>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
    </div>
  );
}

/** Minimal styled table primitives — tables stay server-rendered. */
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-100 text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={clsx("whitespace-nowrap bg-gray-50/80 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={clsx("whitespace-nowrap px-4 py-3 text-gray-700", className)}>{children}</td>;
}
