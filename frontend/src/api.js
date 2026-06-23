const BASE = "/api";

function getToken() {
  return localStorage.getItem("ta_token");
}

export function setToken(token) {
  localStorage.setItem("ta_token", token);
}

export function clearToken() {
  localStorage.removeItem("ta_token");
  localStorage.removeItem("ta_user");
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem("ta_user") || "null");
  } catch {
    return null;
  }
}

export function setUser(user) {
  localStorage.setItem("ta_user", JSON.stringify(user));
}

export function isAdmin() {
  return getUser()?.role === "admin";
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 401) {
    clearToken();
    window.location.href = "/login";
    return;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Auth
  authStatus: () => request("/auth/status"),
  setup: (username, password) => request("/auth/setup", { method: "POST", body: { username, password } }),
  login: (username, password) => request("/auth/login", { method: "POST", body: { username, password } }),
  me: () => request("/auth/me"),
  changePassword: (current_password, new_password) => request("/auth/change-password", { method: "POST", body: { current_password, new_password } }),

  // Admin user management
  listUsers: () => request("/auth/users"),
  createUser: (username, password, role) => request("/auth/users", { method: "POST", body: { username, password, role } }),
  updateUser: (id, data) => request(`/auth/users/${id}`, { method: "PATCH", body: data }),
  resetUserPassword: (id, new_password) => request(`/auth/users/${id}/reset-password`, { method: "POST", body: { new_password } }),
  deleteUser: (id) => request(`/auth/users/${id}`, { method: "DELETE" }),

  // Items
  getItems: () => request("/items/"),
  getItem: (id) => request(`/items/${id}`),
  createItem: (data) => request("/items/", { method: "POST", body: data }),
  updateItem: (id, data) => request(`/items/${id}`, { method: "PATCH", body: data }),
  deleteItem: (id) => request(`/items/${id}`, { method: "DELETE" }),

  // Products
  getProducts: (itemId) => request(`/products/${itemId ? `?item_id=${itemId}` : ""}`),
  getProduct: (id) => request(`/products/${id}`),
  getProductHistory: (id) => request(`/products/${id}/history`),
  previewUrl: (url) => request("/products/preview", { method: "POST", body: { url } }),
  searchStore: (storeId, query) => request("/products/search", { method: "POST", body: { store_id: storeId, query } }),
  createProduct: (data) => request("/products/", { method: "POST", body: data }),
  deleteProduct: (id) => request(`/products/${id}`, { method: "DELETE" }),
  toggleProduct: (id) => request(`/products/${id}/toggle`, { method: "PATCH" }),
  rescrapeItem: (itemId) => request(`/products/rescrape/item/${itemId}`, { method: "POST" }),
  rescrapeAll: () => request("/products/rescrape/all", { method: "POST" }),

  // Stores
  getStores: () => request("/stores/"),
  updateStore: (id, data) => request(`/stores/${id}`, { method: "PATCH", body: data }),
  reorderStores: (order) => request("/stores/reorder", { method: "POST", body: { order } }),
  scanDrakesStores: () => request("/stores/drakes-scan"),
  saveDrakesStores: (stores) => request("/stores/drakes-save", { method: "POST", body: { stores } }),

  // Journey
  getJourney: () => request("/journey/"),

  // Settings
  getSettings: () => request("/settings/"),
  updateSettings: (settings) => request("/settings/", { method: "PUT", body: { settings } }),
  testEmail: (to) => request("/settings/test-email", { method: "POST", body: { to } }),
  testProxy: () => request("/settings/test-proxy", { method: "POST" }),
};
