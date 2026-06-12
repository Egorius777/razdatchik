"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  CheckCircle2,
  Wallet,
  Settings,
  History,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Role = "Distributor" | "Tutor";

const tutorTabs = [
  { href: "/", label: "Главная", icon: Home },
  { href: "/students", label: "Ученики", icon: GraduationCap },
  { href: "/history", label: "История", icon: History },
  { href: "/settings", label: "Ещё", icon: Settings },
];

const distributorTabs = [
  { href: "/", label: "Дашборд", icon: Home },
  { href: "/confirmations", label: "Очередь", icon: CheckCircle2 },
  { href: "/payouts", label: "Выплаты", icon: Wallet },
  { href: "/tutors", label: "Команда", icon: Users },
  { href: "/settings", label: "Ещё", icon: Settings },
];

export function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const tabs = role === "Distributor" ? distributorTabs : tutorTabs;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-black/5 bg-[var(--tg-secondary-bg)] pb-[var(--safe-bottom)]">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px]",
                active ? "text-[var(--tg-link)]" : "text-[var(--tg-hint)]"
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
