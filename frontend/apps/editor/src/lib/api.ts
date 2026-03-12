import axios from 'axios';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000
});

export async function apiGet<T>(url: string, accessToken?: string, params?: Record<string, unknown>): Promise<T> {
  const response = await client.get<T>(url, {
    params,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
  });
  return response.data;
}

export async function apiPost<T>(url: string, body: Record<string, unknown>, accessToken?: string): Promise<T> {
  const response = await client.post<T>(url, body, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
  });
  return response.data;
}

export async function apiPut<T>(url: string, body: Record<string, unknown>, accessToken?: string): Promise<T> {
  const response = await client.put<T>(url, body, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
  });
  return response.data;
}
