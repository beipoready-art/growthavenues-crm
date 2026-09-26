/* eslint-disable @next/next/no-img-element -- logo is served by our own API route */
export function Logo({ className = "", firmName = "GrowthAvenues", logoUrl }: { className?: string; firmName?: string; logoUrl?: string | null }) {
  const words = firmName.trim().split(/\s+/);
  // "GrowthAvenues Securities" → "GS"; a single CamelCase word → its capitals ("GA").
  const initials = (words.length > 1 ? words.map((w) => w[0]).join("") : (firmName.match(/[A-Z]/g)?.join("") ?? firmName[0] ?? ""))
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className={`flex min-w-0 items-center gap-2 ${className}`}>
      {logoUrl ? (
        <img src={logoUrl} alt="" className="h-7 w-7 shrink-0 rounded-md object-contain" />
      ) : (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-600 text-xs font-bold text-white">{initials || "GA"}</div>
      )}
      <span className="truncate text-sm font-semibold tracking-tight text-gray-900" data-testid="firm-name">
        {firmName}
      </span>
    </div>
  );
}
