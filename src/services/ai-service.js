const { generateText } = require("ai");
const { createGateway } = require("@ai-sdk/gateway");
const { AI_ENABLED, AI_GATEWAY_API_KEY } = require("../config/env");
const { logError } = require("../utils/logger");

// AI Gateway model IDs (provider/model.version format)
// Docs: https://vercel.com/docs/ai-gateway
// Auth: VERCEL_OIDC_TOKEN (auto on Vercel) or AI_GATEWAY_API_KEY (standalone server)
const MODEL_FAST = "anthropic/claude-haiku-4.5";
const MODEL_SMART = "anthropic/claude-sonnet-4.6";

function buildProductCatalogContext(products) {
  if (!products || products.length === 0) {
    return "Каталог товаров пуст.";
  }
  return products
    .map(
      (p) =>
        `- [${p.code}] ${p.title}: ${p.description || ""} | Цена: ${p.price_text || "уточняйте"}`,
    )
    .join("\n");
}

function buildConversationHistory(messages) {
  if (!messages || messages.length === 0) {
    return [];
  }
  return messages.map((m) => ({
    role: m.sender_role === "admin" ? "assistant" : "user",
    content: m.message_text || "(медиа)",
  }));
}

function createAiService({ repos }) {
  if (!AI_ENABLED) {
    return {
      isEnabled: false,
      generateClientAutoReply: async () => null,
      generateAdminSuggestedReply: async () => null,
      summarizeConversation: async () => null,
    };
  }

  // createGateway picks up VERCEL_OIDC_TOKEN automatically when on Vercel.
  // For standalone deployments, pass AI_GATEWAY_API_KEY explicitly.
  const gw = createGateway(AI_GATEWAY_API_KEY ? { apiKey: AI_GATEWAY_API_KEY } : {});

  async function generateClientAutoReply({ products, conversationMessages, clientMessage }) {
    const catalogText = buildProductCatalogContext(products);
    try {
      const { text } = await generateText({
        model: gw(MODEL_FAST),
        system:
          `Ты — вежливый помощник интернет-магазина. Отвечай только по-русски, коротко и по делу.\n` +
          `Каталог товаров:\n${catalogText}\n\n` +
          `Если вопрос не связан с товарами, предложи оставить заявку или написать менеджеру.\n` +
          `Не придумывай цены или характеристики, которых нет в каталоге. Если не знаешь — скажи "уточню у менеджера".\n` +
          `Максимум 3 предложения.`,
        messages: [
          ...buildConversationHistory(conversationMessages.slice(-6)),
          { role: "user", content: clientMessage },
        ],
      });
      return text;
    } catch (error) {
      logError("AI generateClientAutoReply failed", error);
      return null;
    }
  }

  async function generateAdminSuggestedReply({ products, conversationMessages }) {
    const catalogText = buildProductCatalogContext(products);
    const history = buildConversationHistory(conversationMessages.slice(-10));
    if (history.length === 0) {
      return null;
    }
    try {
      const { text } = await generateText({
        model: gw(MODEL_SMART),
        system:
          `Ты — помощник менеджера интернет-магазина. Составь вариант ответа клиенту на русском языке.\n` +
          `Тон: профессиональный, дружелюбный, конкретный.\n` +
          `Каталог товаров:\n${catalogText}\n\n` +
          `Учти контекст диалога. Напиши только текст ответа, без вводных слов вроде "Вот вариант ответа:".`,
        messages: history,
      });
      return text;
    } catch (error) {
      logError("AI generateAdminSuggestedReply failed", error);
      return null;
    }
  }

  async function summarizeConversation({ conversationMessages, lead }) {
    const history = buildConversationHistory(conversationMessages);
    if (history.length === 0) {
      return null;
    }
    const leadInfo = lead
      ? `Последняя заявка: товар "${lead.product_name}", кол-во ${lead.quantity}, статус: ${lead.status}.`
      : "";
    try {
      const { text } = await generateText({
        model: gw(MODEL_SMART),
        system:
          `Ты — аналитик CRM. Составь краткое резюме диалога с клиентом на русском языке.\n` +
          `Включи: о чём спрашивал клиент, какие товары интересовали, текущий статус и рекомендуемое следующее действие.\n` +
          `${leadInfo}\nМаксимум 5 коротких пунктов.`,
        messages: history,
      });
      return text;
    } catch (error) {
      logError("AI summarizeConversation failed", error);
      return null;
    }
  }

  return {
    isEnabled: true,
    generateClientAutoReply,
    generateAdminSuggestedReply,
    summarizeConversation,
  };
}

module.exports = { createAiService };
