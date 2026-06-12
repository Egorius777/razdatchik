"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type TelegramWebApp = {
  ready: () => void;
  expand: () => void;
  HapticFeedback?: { impactOccurred: (style: string) => void };
  themeParams: Record<string, string | undefined>;
  initData: string;
  MainButton: {
    setText: (text: string) => void;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
    enable: () => void;
    disable: () => void;
  };
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  close: () => void;
};

type Ctx = {
  webApp: TelegramWebApp | null;
  initData: string;
  haptic: (style?: "light" | "medium" | "heavy") => void;
};

const TelegramCtx = createContext<Ctx>({
  webApp: null,
  initData: "",
  haptic: () => {},
});

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);

  useEffect(() => {
    const tg = (window as unknown as { Telegram?: { WebApp: TelegramWebApp } }).Telegram?.WebApp;
    if (!tg) return;
    tg.ready();
    tg.expand();
    setWebApp(tg);

    const params = tg.themeParams;
    const root = document.documentElement;
    for (const [key, value] of Object.entries(params)) {
      if (value) root.style.setProperty(`--tg-theme-${key.replace(/_/g, "-")}`, value);
    }
  }, []);

  const value = useMemo(
    () => ({
      webApp,
      initData: webApp?.initData ?? "",
      haptic: (style: "light" | "medium" | "heavy" = "light") => {
        webApp?.HapticFeedback?.impactOccurred(style);
      },
    }),
    [webApp]
  );

  return <TelegramCtx.Provider value={value}>{children}</TelegramCtx.Provider>;
}

export function useTelegram() {
  return useContext(TelegramCtx);
}
