const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
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

  // Stores
  getStores: () => request("/stores/"),

  // Journey
  getJourney: () => request("/journey/"),

  // Settings
  getSettings: () => request("/settings/"),
  updateSettings: (settings) => request("/settings/", { method: "PUT", body: { settings } }),
};
