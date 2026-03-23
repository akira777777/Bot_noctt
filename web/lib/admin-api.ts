import "server-only";

const API_URL = process.env.API_URL || "http://localhost:3081";
const API_SECRET = process.env.API_SECRET || "";

function getAdminHeaders(headers?: HeadersInit): Headers {
  if (!API_SECRET.trim()) {
    throw new Error("Admin API is not configured");
  }

  const merged = new Headers(headers);
  if (!merged.has("Content-Type")) {
    merged.set("Content-Type", "application/json");
  }
  merged.set("X-Api-Key", API_SECRET);
  return merged;
}

export async function adminFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API_URL}/api/admin${path}`, {
    ...init,
    cache: "no-store",
    headers: getAdminHeaders(init.headers),
  });

  return response;
}

export async function adminFetchJson<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await adminFetch(path, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error || `API error ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function fetchLeads(params?: { status?: string; page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();

  return adminFetchJson<{
    ok: boolean;
    leads: Lead[];
    pagination: Pagination;
  }>(`/leads${qs ? `?${qs}` : ""}`);
}

export function fetchLead(id: number) {
  return adminFetchJson<{
    ok: boolean;
    lead: Lead;
    client: User | null;
  }>(`/leads/${id}`);
}

export function fetchConversations(limit = 20) {
  return adminFetchJson<{
    ok: boolean;
    conversations: Conversation[];
  }>(`/conversations?limit=${limit}`);
}

export function fetchMessages(clientId: number, limit = 50) {
  return adminFetchJson<{
    ok: boolean;
    conversation: Conversation;
    client: User | null;
    messages: Message[];
  }>(`/conversations/${clientId}/messages?limit=${limit}`);
}

export function fetchProducts() {
  return adminFetchJson<{ ok: boolean; products: Product[] }>("/products");
}

export function fetchUsers(params?: { page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();

  return adminFetchJson<{
    ok: boolean;
    users: User[];
    pagination: Pagination;
  }>(`/users${qs ? `?${qs}` : ""}`);
}

export function fetchStats() {
  return adminFetchJson<{
    ok: boolean;
    stats: {
      total: number;
      newToday: number;
      byStatus: { status: string; cnt: number }[];
      topProducts: { product_name: string; cnt: number }[];
      dashboard?: {
        last24Hours: {
          draftsStarted: number;
          confirmedLeads: number;
        };
        overdueLeads: number;
      };
    };
  }>("/stats");
}

export function fetchDailyStats(days = 30) {
  return adminFetchJson<{
    ok: boolean;
    daily: { day: string; cnt: number }[];
  }>(`/stats/daily?days=${days}`);
}

export interface Product {
  id: number;
  code: string;
  title: string;
  description: string;
  price_text: string;
  is_active: number;
  sort_order: number;
}

export interface Lead {
  id: number;
  status: string;
  status_label: string;
  closed_reason?: string | null;
  product_code: string;
  product_name: string;
  quantity: number;
  comment: string;
  contact_label: string;
  client_telegram_id: number;
  username: string;
  first_name: string;
  last_name: string;
  source_payload: string;
  first_admin_reply_at?: string | null;
  next_follow_up_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: number;
  client_telegram_id: number;
  admin_telegram_id: number;
  source_payload: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_role: string;
  sender_telegram_id: number;
  message_text: string;
  message_type: string;
  created_at: string;
}

export interface User {
  telegram_id: number;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  is_blocked: number;
  created_at: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}
