const API_URL = process.env.API_URL || "http://localhost:3000";

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const { headers: extraHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extraHeaders as Record<string, string>),
  };

  const res = await fetch(`${API_URL}/api${path}`, {
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

export function fetchLeadStatus(trackingToken: string) {
  return apiFetch<{
    ok: boolean;
    lead: {
      tracking_token: string;
      status: string;
      status_label: string;
      product_name: string;
      quantity: number;
      created_at: string;
    };
  }>(`/lead/track/${trackingToken}/status`);
}

export function submitWebLead(data: {
  product_code: string;
  quantity: number;
  comment?: string;
  contact_label: string;
  source?: string;
}) {
  return apiFetch<{ ok: boolean; lead: { tracking_token: string; status: string } }>("/lead", {
    method: "POST",
    body: JSON.stringify(data),
  });
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
