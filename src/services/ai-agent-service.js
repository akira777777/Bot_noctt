'use strict';

const { ToolLoopAgent, tool, jsonSchema, stepCountIs } = require('ai');
const { gateway } = require('@ai-sdk/gateway');
const { logError, logInfo } = require('../utils/logger');

/**
 * Vercel AI Gateway setup — OIDC is the recommended approach:
 *   1. Run `vercel link` to connect this project to Vercel.
 *   2. Run `vercel env pull` — writes VERCEL_OIDC_TOKEN to .env.local.
 *      Tokens refresh automatically; no manual rotation required.
 *      On Vercel deployments this is provisioned automatically.
 *
 * Set AI_ENABLED=false in .env to disable AI without removing credentials.
 *
 * Model string: "provider/model" with dot-separated versions, e.g.
 *   "anthropic/claude-haiku-4.5" or "anthropic/claude-sonnet-4.6"
 *
 * Returns null when credentials are absent — AI degrades gracefully to the
 * existing forward-to-admin flow with no behaviour change.
 */
function createAiAgentService({ repos, catalogService, config }) {
  if (!config.enabled) return null;

  // @ai-sdk/gateway reads VERCEL_OIDC_TOKEN from env automatically.
  // Credentials must be present in the environment before the process starts
  // (via `vercel env pull` locally, or auto-provisioned on Vercel).
  const hasCredentials = Boolean(process.env.VERCEL_OIDC_TOKEN);
  if (!hasCredentials) return null;

  const model = gateway(config.aiModel);

  // ── Client subagent ───────────────────────────────────────────────────────
  // Skills: browse catalog, get product details, check order status, escalate
  const clientAgent = new ToolLoopAgent({
    model,
    instructions: buildClientInstructions(),
    stopWhen: stepCountIs(5),
    tools: {
      list_products: tool({
        description: 'List all active products with prices and descriptions',
        inputSchema: jsonSchema({ type: 'object', properties: {} }),
        execute: async () =>
          catalogService.listProducts().map((p) => ({
            id: p.id,
            code: p.code,
            title: p.title,
            description: p.description || '',
            price: p.price_text || '',
          })),
      }),

      get_product_details: tool({
        description: 'Get full details for a product by numeric ID',
        inputSchema: jsonSchema({
          type: 'object',
          properties: {
            product_id: { type: 'integer', description: 'Numeric product ID' },
          },
          required: ['product_id'],
        }),
        execute: async ({ product_id }) =>
          catalogService.getProductById(product_id) || { error: 'Not found' },
      }),

      check_lead_status: tool({
        description: "Check the status of the client's latest order",
        inputSchema: jsonSchema({ type: 'object', properties: {} }),
        execute: async (_, { context }) => {
          const lead = context?.clientId
            ? repos.leads.getLatestByClient(context.clientId)
            : null;
          if (!lead) return { hasLeads: false };
          return {
            hasLeads: true,
            id: lead.id,
            product: lead.product_name,
            quantity: lead.quantity,
            status: lead.status,
            createdAt: lead.created_at,
          };
        },
      }),

      forward_to_manager: tool({
        description:
          'Call this when the question requires a human or is outside your scope',
        inputSchema: jsonSchema({ type: 'object', properties: {} }),
        // No execute — caller detects this tool call as an escalation signal
      }),
    },
  });

  // ── Admin subagent ────────────────────────────────────────────────────────
  // Skills: pipeline stats, recent leads, client conversation history
  const adminAgent = new ToolLoopAgent({
    model,
    instructions:
      'Ты — AI-ассистент администратора. Отвечай по-русски, структурированно и кратко. ' +
      'Помогаешь анализировать воронку продаж, заявки и диалоги с клиентами.',
    stopWhen: stepCountIs(5),
    tools: {
      get_pipeline_stats: tool({
        description: 'Get funnel and SLA stats for the last 24h and 7 days',
        inputSchema: jsonSchema({ type: 'object', properties: {} }),
        execute: async (_, { context }) =>
          context?.services?.admin.getDashboardStats(),
      }),

      list_leads: tool({
        description: 'List the most recent leads/orders',
        inputSchema: jsonSchema({
          type: 'object',
          properties: {
            limit: { type: 'integer', default: 5 },
          },
        }),
        execute: async ({ limit = 5 }, { context }) =>
          context?.services?.admin.listRecentLeads(limit),
      }),

      get_client_history: tool({
        description: 'Get message history for a client by their Telegram ID',
        inputSchema: jsonSchema({
          type: 'object',
          properties: {
            client_id: { type: 'integer', description: 'Telegram user ID' },
          },
          required: ['client_id'],
        }),
        execute: async ({ client_id }, { context }) =>
          context?.services?.admin.getClientHistory(client_id),
      }),
    },
  });

  /**
   * Handle a free-form client message.
   * @returns {{ handled: true, text: string } | { handled: false }}
   */
  async function runClientAgent({ clientId, messageText }) {
    try {
      const result = await clientAgent.generate({
        prompt: messageText,
        context: { clientId },
      });

      const toolCalls = result.steps?.flatMap((s) => s.toolCalls ?? []) ?? [];
      if (toolCalls.some((tc) => tc.toolName === 'forward_to_manager')) {
        return { handled: false };
      }

      const text = result.text?.trim();
      if (!text) return { handled: false };

      logInfo('AI client agent responded', { clientId, chars: text.length });
      return { handled: true, text };
    } catch (err) {
      logError('AI client agent error', err);
      return { handled: false };
    }
  }

  /**
   * Answer an admin prompt using pipeline data tools.
   * @returns {{ ok: true, text: string } | { ok: false, error: string }}
   */
  async function runAdminAgent({ prompt, services }) {
    try {
      const result = await adminAgent.generate({
        prompt,
        context: { services },
      });
      return { ok: true, text: result.text?.trim() || '(пустой ответ)' };
    } catch (err) {
      logError('AI admin agent error', err);
      return { ok: false, error: err.message };
    }
  }

  return { runClientAgent, runAdminAgent };
}

function buildClientInstructions() {
  return (
    'Ты — вежливый помощник интернет-магазина. Общайся по-русски, кратко и по делу.\n\n' +
    'Ты умеешь:\n' +
    '  • Отвечать на вопросы о товарах и их характеристиках\n' +
    '  • Проверять статус заявки клиента\n' +
    '  • Объяснять процесс оформления заявки\n\n' +
    'Если клиент хочет оформить заявку — скажи: «Нажмите «Оставить заявку» или используйте /menu.»\n' +
    'Если вопрос вне твоих возможностей или нужна ручная обработка — вызови forward_to_manager.\n' +
    'Отвечай лаконично, без лишних слов.'
  );
}

module.exports = { createAiAgentService };
