// src/api/client.ts
import { API_BASE_URL } from "../config";

export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem("authToken");
}

async function request<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const token = getAuthToken();
  if (token) {
    (headers as any)["Authorization"] = `Bearer ${token}`;
  }

  const resp = await fetch(url, {
    ...options,
    headers,
  });

  const text = await resp.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }

  if (!resp.ok) {
    if (resp.status === 401) {
      // На всякий случай чистим токен
      localStorage.removeItem("authToken");
      localStorage.removeItem("authUsername");
    }

    const message =
      (data && (data.detail || data.message)) ||
      `Request failed with status ${resp.status}`;

    throw new ApiError(message, resp.status, data);
  }

  return data as T;
}

export const apiGet = <T = any>(path: string) =>
  request<T>(path, { method: "GET" });

export const apiPost = <T = any>(path: string, body?: any) =>
  request<T>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
