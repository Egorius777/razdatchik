import { Bot } from "grammy";
import { getBotToken, getPublicAppUrl } from "@/lib/telegram";

function verifyCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("x-cron-secret") === secret;
}

export async function POST(request: Request) {
  if (!verifyCron(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const bot = new Bot(getBotToken());
    const url = `${getPublicAppUrl()}/api/bot`;
    await bot.api.setWebhook(url);
    const info = await bot.api.getWebhookInfo();

    return Response.json({
      ok: true,
      webhookUrl: info.url,
      pendingUpdateCount: info.pending_update_count,
      lastErrorMessage: info.last_error_message ?? null,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to set webhook" }, { status: 500 });
  }
}
