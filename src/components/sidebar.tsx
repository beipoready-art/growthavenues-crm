"use client";

import clsx from "clsx";
import { Briefcase, LayoutDashboard, Rocket, TrendingUp, LogOut, ShieldCheck, Target, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Role } from "@prisma/client";
import { Logo } from "@/components/brand";
import { ROLE_LABELS } from "@/lib/labels";
import { can, type Permission } from "@/lib/rbac";

type NavItem = { href: string; label: string; icon: LucideIcon; permission?: Permission };

const NAV: { section?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/leads", label: "Leads", icon: Target, permission: "leads:view" },
      { href: "/clients", label: "Clients", icon: Briefcase, permission: "clients:view" },
      { href: "/kyc", label: "KYC queue", icon: ShieldCheck, permission: "clients:view" },
      { href: "/ipos", label: "IPOs", icon: Rocket, permission: "ipos:view" },
    ],
  },
  {
    section: "Insights",
    items: [
      { href: "/performance", label: "Performance", icon: TrendingUp, permission: "performance:view" },
    ],
  },
  { section: "Admin", items: [{ href: "/users", label: "Users", icon: Users, permission: "users:manage" }] },
];

export function Sidebar({ user }: { user: { name: string; email: string; role: Role } }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-14 items-center border-b border-gray-100 px-4">
        <Logo />
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV.map((group, i) => {
          const items = group.items.filter((item) => !item.permission || can(user.role, item.permission));
          if (!items.length) return null;
          return (
            <div key={i}>
              {group.section && <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wider text-gray-400">{group.section}</p>}
              <ul className="space-y-0.5">
                {items.map(({ href, label, icon: Icon }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className={clsx(
                        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                        isActive(href) ? "bg-gray-100 font-medium text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                      )}
                    >
                      <Icon size={16} className={isActive(href) ? "text-brand-600" : "text-gray-400"} />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
            {user.name
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
            <p className="truncate text-xs text-gray-500">{ROLE_LABELS[user.role]}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
