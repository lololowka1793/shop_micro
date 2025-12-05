// src/config.ts

// Gateway
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

// Auth
export const AUTH_BASE_URL =
  import.meta.env.VITE_AUTH_API_URL || "http://localhost:8001";

// Users
export const USERS_BASE_URL =
  import.meta.env.VITE_USERS_API_URL || "http://localhost:8002";

// Catalog
export const CATALOG_BASE_URL =
  import.meta.env.VITE_CATALOG_API_URL || "http://localhost:8003";

// Orders
export const ORDERS_BASE_URL =
  import.meta.env.VITE_ORDERS_API_URL || "http://localhost:8004";
