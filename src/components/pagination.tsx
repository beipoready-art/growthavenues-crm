import Link from "next/link";
import { PAGE_SIZE, type SearchParams } from "@/lib/filters";

export function Pagination({ total, page, pathname, searchParams }: { total: number; page: number; pathname: string; searchParams: SearchParams }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (typeof v === "string" && k !== "page") qs.set(k, v);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `${pathname}?${s}` : pathname;
  };
  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(total, page * PAGE_SIZE);
  const linkClass = "rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50";
  return (
    <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5 text-xs text-gray-500">
      <span>
        {start}–{end} of {total}
      </span>
      {pages > 1 && (
        <div className="flex gap-1.5">
          {page > 1 && (
            <Link className={linkClass} href={href(page - 1)}>
              Previous
            </Link>
          )}
          {page < pages && (
            <Link className={linkClass} href={href(page + 1)}>
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
