import { Platform } from "react-native";

const configuredBase = String(process.env.EXPO_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
function defaultWebBase() {
  if (Platform.OS !== "web" || typeof window === "undefined") return "http://127.0.0.1:3001";
  const url = new URL(window.location.origin);
  if (["8081", "8082", "19006"].includes(url.port)) url.port = "3001";
  return url.origin;
}
export const API_BASE = configuredBase || (
  defaultWebBase()
);

export const apiUrl = (path) => `${API_BASE}${String(path).startsWith("/") ? path : `/${path}`}`;

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  let response;
  try {
    response = await fetch(apiUrl(path), { ...options, headers });
  } catch {
    throw new Error("Could not reach the NextGen server. Check the API address and network connection.");
  }
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || `Server request failed (${response.status}).`);
  return payload;
}
