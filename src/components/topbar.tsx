import { Globe, Mail, Phone } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import type { CompanyProfileView } from "@/lib/company";

/** App header: firm contact details (from Settings) and the notification bell. */
export function TopBar({ unread, company }: { unread: number; company: CompanyProfileView }) {
  const contact = [
    company.phone && { icon: Phone, text: company.phone, href: `tel:${company.phone.replace(/\s/g, "")}` },
    company.email && { icon: Mail, text: company.email, href: `mailto:${company.email}` },
    company.website && { icon: Globe, text: company.website.replace(/^https?:\/\//, ""), href: company.website },
  ].filter(Boolean) as { icon: typeof Phone; text: string; href: string }[];

  return (
    <header className="sticky top-0 z-20 flex h-12 items-center justify-between gap-4 border-b border-gray-200 bg-white/90 px-6 backdrop-blur" data-testid="topbar">
      <div className="flex min-w-0 items-center gap-4 text-xs text-gray-500">
        {company.tagline && <span className="hidden truncate font-medium text-gray-700 lg:inline">{company.tagline}</span>}
        {contact.map(({ icon: Icon, text, href }) => (
          <a key={text} href={href} className="hidden items-center gap-1 hover:text-gray-900 md:inline-flex">
            <Icon size={12} /> {text}
          </a>
        ))}
        {company.sebiRegistration && <span className="hidden xl:inline">SEBI Reg. {company.sebiRegistration}</span>}
      </div>
      <NotificationBell unread={unread} />
    </header>
  );
}
