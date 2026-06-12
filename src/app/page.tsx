"use client";

import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { HomePage } from "@/components/pages/home-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AppShell>
        <HomePage />
      </AppShell>
    </Suspense>
  );
}
