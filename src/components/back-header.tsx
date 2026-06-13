"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useTelegram } from "@/components/telegram-provider";

type BackHeaderProps = {
  href: string;
  title: string;
  subtitle?: string;
};

export function BackHeader({ href, title, subtitle }: BackHeaderProps) {
  const router = useRouter();
  const { webApp } = useTelegram();

  useEffect(() => {
    const goBack = () => router.push(href);
    webApp?.BackButton?.show();
    webApp?.BackButton?.onClick(goBack);
    return () => {
      webApp?.BackButton?.offClick(goBack);
      webApp?.BackButton?.hide();
    };
  }, [webApp, href, router]);

  return (
    <div className="mb-4 flex items-center gap-2">
      <Link
        href={href}
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--tg-muted-surface)]"
        aria-label="Назад"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <header className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-[var(--tg-hint)]">{subtitle}</p> : null}
      </header>
    </div>
  );
}
