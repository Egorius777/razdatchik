import { Bot } from "grammy";
import { prisma } from "@/lib/db";
import { getPublicAppUrl } from "@/lib/telegram";

let botInstance: Bot | null = null;

function getBot(): Bot {
  if (!botInstance) {
    const token = process.env.BOT_TOKEN;
    if (!token) {
      throw new Error("BOT_TOKEN is not configured");
    }
    botInstance = new Bot(token);
    botInstance.command("start", async (ctx) => {
      const payload = ctx.match?.trim();
      const appUrl = getPublicAppUrl();

      if (payload) {
        const invite = await prisma.invite.findUnique({
          where: { code: payload.toUpperCase() },
        });

        if (invite && !invite.usedById) {
          await ctx.reply(
            `Приглашение найдено! Откройте приложение — код ${payload.toUpperCase()} будет применён при входе.`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "Открыть приложение",
                      web_app: { url: `${appUrl}?invite=${payload.toUpperCase()}` },
                    },
                  ],
                ],
              },
            }
          );
          return;
        }
      }

      await ctx.reply("Добро пожаловать в Раздатчик — учёт уроков и выплат.", {
        reply_markup: {
          inline_keyboard: [[{ text: "Открыть приложение", web_app: { url: appUrl } }]],
        },
      });
    });
  }
  return botInstance;
}

let initPromise: Promise<void> | null = null;

export async function POST(request: Request) {
  try {
    const bot = getBot();
    if (!initPromise) initPromise = bot.init();
    await initPromise;
    const update = await request.json();
    await bot.handleUpdate(update);
    return new Response("OK");
  } catch (error) {
    console.error("bot webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(message, { status: 500 });
  }
}

export const GET = () => Response.json({ ok: true, bot: "razdatchik" });
