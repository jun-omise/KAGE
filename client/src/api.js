/**
 * KAGE APIクライアント
 * 全API呼び出しの共通処理（認証ヘッダー、エラーハンドリング、トークン管理）
 */
const BASE_URL = '/api';
const TOKEN_KEY = 'kage_token';

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request(method, path, body = null) {
  const options = {
    method,
    headers: getHeaders(),
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${path}`, options);

  // Handle 401 — auto-logout
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.dispatchEvent(new CustomEvent('kage:auth:expired'));
    throw new Error('認証が切れました');
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `API Error (${res.status})`);
  }

  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),
};

// Token management utilities
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function hasToken() {
  return !!localStorage.getItem(TOKEN_KEY);
}
