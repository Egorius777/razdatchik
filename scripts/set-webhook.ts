import { Bot } from "grammy";
import { getBotToken, getPublicAppUrl } from "@/lib/telegram";

async function main() {
  const bot = new Bot(getBotToken());
  const url = `${getPublicAppUrl()}/api/bot`;
  await bot.api.setWebhook(url);
  console.log(`Webhook set to ${url}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
