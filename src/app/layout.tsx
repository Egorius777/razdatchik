"use client";

import Script from "next/script";
import { TelegramProvider } from "@/components/telegram-provider";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>Раздатчик</title>
      </head>
      <body>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <TelegramProvider>{children}</TelegramProvider>
      </body>
    </html>
  );
}
