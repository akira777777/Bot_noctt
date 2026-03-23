const API_URL = process.env.API_URL || "http://localhost:3081";
const API_SECRET = process.env.API_SECRET || "";

interface FetchOptions extends RequestInit {
  admin?: boolean;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { admin = false, headers: extraHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extraHeaders as Record<string, string>),
  };

  if (admin) {
    headers["X-Api-Key"] = API_SECRET;
  }

  const prefix = admin ? "/api/admin" : "/api";
  const res = await fetch(`${API_URL}${prefix}${path}`, {
    headers,
    ...rest,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `API error ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// --- Public API ---

export function fetchCatalog() {
  return apiFetch<{
    ok: boolean;
    products: Product[];
  }>("/catalog");
}

export function fetchLeadStatus(id: number) {
  return apiFetch<{
    ok: boolean;
    lead: { id: number; status: string; status_label: string; product_name: string; quantity: number; created_at: string };
  }>(`/lead/${id}/status`);
}

export function submitWebLead(data: {
  product_code: string;
  quantity: number;
  comment?: string;
  contact_label: string;
  source?: string;
}) {
  return apiFetch<{ ok: boolean; lead: { id: number } }>("/lead", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// --- Admin API ---

export function fetchLeads(params?: { status?: string; page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return apiFetch<{
    ok: boolean;
    leads: Lead[];
    pagination: Pagination;
  }>(`/leads${qs ? `?${qs}` : ""}`, { admin: true });
}

export function fetchLead(id: number) {
  return apiFetch<{
    ok: boolean;
    lead: Lead;
    client: User | null;
  }>(`/leads/${id}`, { admin: true });
}

export function updateLeadStatus(id: number, status: string) {
  return apiFetch<{ ok: boolean; lead: Lead }>(`/leads/${id}/status`, {
    admin: true,
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function fetchConversations(limit = 20) {
  return apiFetch<{
    ok: boolean;
    conversations: Conversation[];
  }>(`/conversations?limit=${limit}`, { admin: true });
}

export function fetchMessages(clientId: number, limit = 50) {
  return apiFetch<{
    ok: boolean;
    conversation: Conversation;
    client: User | null;
    messages: Message[];
  }>(`/conversations/${clientId}/messages?limit=${limit}`, { admin: true });
}

export function sendReply(clientId: number, text: string) {
  return apiFetch<{ ok: boolean }>(`/conversations/${clientId}/reply`, {
    admin: true,
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export function fetchProducts() {
  return apiFetch<{ ok: boolean; products: Product[] }>("/products", { admin: true });
}

export function createProduct(data: { code: string; title: string; description?: string; price_text?: string }) {
  return apiFetch<{ ok: boolean; product: Product }>("/products", {
    admin: true,
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateProduct(id: number, data: Partial<Product>) {
  return apiFetch<{ ok: boolean; product: Product }>(`/products/${id}`, {
    admin: true,
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function toggleProduct(id: number) {
  return apiFetch<{ ok: boolean; product: Product }>(`/products/${id}/toggle`, {
    admin: true,
    method: "PATCH",
  });
}

export function fetchUsers(params?: { page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return apiFetch<{
    ok: boolean;
    users: User[];
    pagination: Pagination;
  }>(`/users${qs ? `?${qs}` : ""}`, { admin: true });
}

export function toggleUserBlock(id: number) {
  return apiFetch<{ ok: boolean; user: User }>(`/users/${id}/block`, {
    admin: true,
    method: "PATCH",
  });
}

export function fetchStats() {
  return apiFetch<{
    ok: boolean;
    stats: { total: number; newToday: number; byStatus: Record<string, number>; topProducts: { product_name: string; count: number }[] };
  }>("/stats", { admin: true });
}

export function fetchDailyStats(days = 30) {
  return apiFetch<{
    ok: boolean;
    daily: { date: string; count: number }[];
  }>(`/stats/daily?days=${days}`, { admin: true });
}

// --- Types ---

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
