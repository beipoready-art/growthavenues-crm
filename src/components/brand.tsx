export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-xs font-bold text-white">GA</div>
      <span className="text-sm font-semibold tracking-tight text-gray-900">GrowthAvenues</span>
    </div>
  );
}
