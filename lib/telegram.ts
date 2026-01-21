export type TelegramSendResult =
  | { ok: true; messageId: number; chatId: string }
  | { ok: false; error: string };

type TelegramSendOptions = {
  parseMode?: "HTML" | "Markdown" | "MarkdownV2";
  disableWebPagePreview?: boolean;
  replyMarkup?: TelegramReplyMarkup;
};

type TelegramPayload = {
  ok?: boolean;
  description?: string;
  result?: {
    message_id?: number;
    chat?: {
      id?: number | string;
    };
  };
};

type TelegramInlineKeyboardButton = {
  text: string;
  url: string;
};

type TelegramReplyMarkup = {
  inline_keyboard: TelegramInlineKeyboardButton[][];
};

export async function sendTelegramMessage(
  text: string,
  options: TelegramSendOptions = {},
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) {
    return { ok: false, error: "Missing Telegram config" };
  }

  try {
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text,
      disable_web_page_preview: options.disableWebPagePreview ?? true,
    };
    if (options.parseMode) {
      payload.parse_mode = options.parseMode;
    }
    if (options.replyMarkup) {
      payload.reply_markup = options.replyMarkup;
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const responsePayload = (await res.json().catch(() => ({}))) as TelegramPayload;
    if (!res.ok || !responsePayload.ok) {
      return { ok: false, error: responsePayload?.description ?? "Telegram request failed" };
    }

    const messageId = typeof responsePayload.result?.message_id === "number"
      ? responsePayload.result.message_id
      : 0;
    const resolvedChatId =
      typeof responsePayload.result?.chat?.id === "string" ||
        typeof responsePayload.result?.chat?.id === "number"
        ? String(responsePayload.result?.chat?.id ?? "")
        : chatId;

    return { ok: true, messageId, chatId: resolvedChatId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Telegram request failed";
    return { ok: false, error: message };
  }
}
