import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

function resolveApiBaseUrl() {
  const envApi = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envApi) return envApi;
  if (Platform.OS === "android") return "http://10.0.2.2:4000";
  return "http://localhost:4000";
}

const API_BASE_URL = resolveApiBaseUrl();
const ACCESS_TOKEN_KEY = "finanzas_access_token";
const REFRESH_TOKEN_KEY = "finanzas_refresh_token";

async function getAccessToken() {
  return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
}

export async function saveSession(accessToken: string, refreshToken: string) {
  await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearSession() {
  await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
  await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
}

let _refreshing = false;

async function tryRefreshToken(): Promise<string | null> {
  if (_refreshing) return null;
  _refreshing = true;
  try {
    const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return null;
    const res = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) { await clearSession(); return null; }
    const data = (await res.json()) as AuthResponse;
    await saveSession(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    await clearSession();
    return null;
  } finally {
    _refreshing = false;
  }
}

function buildHeaders(token: string | null, init?: RequestInit): Headers {
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init?.body) headers.set("Content-Type", "application/json");
  return headers;
}

async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: buildHeaders(token, init) });
  if (res.status !== 401) return res;
  // Silent refresh on 401
  const newToken = await tryRefreshToken();
  if (!newToken) return res;
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers: buildHeaders(newToken, init) });
}

export type AuthUser = { id: string; email: string; fullName?: string; username?: string | null };
export type AuthResponse = { accessToken: string; refreshToken: string; user: AuthUser };

export type DashboardResponse = {
  month: string;
  incomeTotalClp: number;
  expenseTotalClp: number;
  savingTotalClp: number;
  overspendPercent: number;
};

export type TransactionItem = {
  id: string;
  type: "income" | "expense";
  amountClp: number;
  rawGlosa: string;
  occurredAt: string;
  categoryId?: string;
  subject?: string;
};

export type Subcategory = {
  id: string;
  name: string;
  colorHex?: string | null;
  icon?: string | null;
};

export type CategoryItem = {
  id: string;
  name: string;
  colorHex?: string | null;
  icon?: string | null;
  subcategories?: Subcategory[];
};

export type GoalItem = {
  id: string;
  name: string;
  targetAmountClp: number;
  monthlyContributionClp: number;
  currentAmountClp: number;
  status: "active" | "paused" | "completed" | "cancelled";
};

export type BudgetItem = {
  id: string;
  categoryId: string;
  year: number;
  month: number;
  amountLimitClp: number;
};

export type MonthlyComparisonItem = {
  month: string;
  incomeTotalClp: number;
  expenseTotalClp: number;
};

export type CategorySpendingItem = {
  categoryName: string;
  totalClp: number;
};

// ─── Auth ──────────────────────────────────────────────────────────────────────

export async function checkUsernameAvailable(username: string): Promise<{ available: boolean; error?: string }> {
  const response = await fetch(`${API_BASE_URL}/v1/auth/check-username/${encodeURIComponent(username)}`);
  if (!response.ok) return { available: false };
  return response.json() as Promise<{ available: boolean; error?: string }>;
}

export async function registerManual(payload: { email: string; password: string; fullName: string; username?: string }) {
  const response = await fetch(`${API_BASE_URL}/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Failed to register");
  return (await response.json()) as AuthResponse;
}

export async function loginManual(payload: { identifier: string; password: string }) {
  const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => ({}))) as AuthResponse & { error?: { message?: string } };
  if (!response.ok) {
    const msg = typeof data.error === "object" && data.error?.message ? data.error.message : "No se pudo iniciar sesión.";
    throw new Error(msg);
  }
  return data as AuthResponse;
}

export async function getCurrentUser() {
  const response = await authFetch("/v1/auth/me");
  if (!response.ok) return null;
  const data = (await response.json()) as { user: AuthUser };
  return data.user;
}

export async function updateProfile(payload: {
  fullName?: string;
  username?: string | null;
  currentPassword?: string;
  newPassword?: string;
}): Promise<AuthUser> {
  const response = await authFetch("/v1/auth/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => ({}))) as { user?: AuthUser; error?: { message?: string } };
  if (!response.ok) {
    const msg = typeof data.error === "object" && data.error?.message ? data.error.message : "No se pudo actualizar el perfil.";
    throw new Error(msg);
  }
  return data.user!;
}

// ─── Categories ────────────────────────────────────────────────────────────────

export async function fetchCategories() {
  const response = await authFetch("/v1/categories");
  if (!response.ok) throw new Error("Failed to load categories");
  const data = (await response.json()) as { items: CategoryItem[] };
  return data.items;
}

export async function seedDefaultCategories() {
  const response = await authFetch("/v1/categories/seed-defaults", { method: "POST" });
  if (!response.ok) return;
}

export async function createCategory(payload: { name: string; colorHex?: string; icon?: string; parentId?: string }) {
  const response = await authFetch("/v1/categories", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Failed to create category");
}

// ─── Transactions ──────────────────────────────────────────────────────────────

export async function fetchTransactions(filters?: { type?: "income" | "expense" | "all"; categoryId?: string; month?: string }) {
  const query = new URLSearchParams();
  if (filters?.type && filters.type !== "all") query.set("type", filters.type);
  if (filters?.categoryId) query.set("categoryId", filters.categoryId);
  if (filters?.month) query.set("month", filters.month);
  const qs = query.toString();
  const response = await authFetch(`/v1/transactions${qs ? `?${qs}` : ""}`);
  if (!response.ok) throw new Error("Failed to load transactions");
  const data = (await response.json()) as { items: TransactionItem[] };
  return data.items;
}

export async function createTransaction(payload: {
  type: "income" | "expense";
  amountClp: number;
  rawGlosa: string;
  occurredAt: string;
  categoryId?: string;
}): Promise<{ id: string }> {
  const response = await authFetch("/v1/transactions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Failed to create transaction");
  return response.json() as Promise<{ id: string }>;
}

export async function updateTransaction(
  id: string,
  payload: { type?: "income" | "expense"; amountClp?: number; rawGlosa?: string; categoryId?: string | null; occurredAt?: string }
) {
  const response = await authFetch(`/v1/transactions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Failed to update transaction");
}

export async function deleteTransaction(id: string) {
  const response = await authFetch(`/v1/transactions/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete transaction");
}

// ─── Goals ────────────────────────────────────────────────────────────────────

export async function fetchGoals() {
  const response = await authFetch("/v1/goals");
  if (!response.ok) throw new Error("Failed to load goals");
  const data = (await response.json()) as { items: GoalItem[] };
  return data.items;
}

export async function createGoal(payload: { name: string; targetAmountClp: number; monthlyContributionClp: number }) {
  const response = await authFetch("/v1/goals", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Failed to create goal");
}

export async function addGoalContribution(goalId: string, amountClp: number) {
  const response = await authFetch(`/v1/goals/${goalId}/contributions`, {
    method: "POST",
    body: JSON.stringify({ amountClp }),
  });
  if (!response.ok) throw new Error("Failed to add contribution");
}

export async function updateGoal(
  goalId: string,
  payload: { name?: string; targetAmountClp?: number; monthlyContributionClp?: number }
) {
  const response = await authFetch(`/v1/goals/${goalId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Failed to update goal");
  return (await response.json()) as GoalItem;
}

export async function deleteGoal(goalId: string) {
  const response = await authFetch(`/v1/goals/${goalId}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete goal");
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export async function fetchDashboard() {
  const response = await authFetch("/v1/reports/dashboard");
  if (!response.ok) throw new Error("Failed to load dashboard");
  return (await response.json()) as DashboardResponse;
}

export async function fetchMonthlyComparison() {
  const response = await authFetch("/v1/reports/monthly-comparison");
  if (!response.ok) throw new Error("Failed to load monthly comparison");
  const data = (await response.json()) as { items: MonthlyComparisonItem[] };
  return data.items;
}

export async function fetchSpendingByCategory() {
  const response = await authFetch("/v1/reports/spending-by-category");
  if (!response.ok) throw new Error("Failed to load category report");
  const data = (await response.json()) as { items: CategorySpendingItem[] };
  return data.items;
}

// ─── Budgets ──────────────────────────────────────────────────────────────────

export async function fetchBudgets(month: string) {
  const response = await authFetch(`/v1/budgets?month=${month}`);
  if (!response.ok) throw new Error("Failed to load budgets");
  const data = (await response.json()) as { items: BudgetItem[] };
  return data.items;
}

export async function upsertBudget(payload: { categoryId: string; year: number; month: number; amountLimitClp: number }) {
  const response = await authFetch("/v1/budgets", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Failed to save budget");
}
