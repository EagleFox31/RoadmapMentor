import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAuthToken, removeAuthToken } from "@/lib/auth";

// Erreur d'API : `message` reste "<statut>: <texte>" (parsé par plusieurs pages), le reste est exposé en champs.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    text: string,
    readonly code?: string,
    readonly reason?: string,
    readonly requestId?: string,
  ) {
    super(`${status}: ${text}`);
    this.name = "ApiError";
  }
}

function parseBody(text: string): Record<string, any> | null {
  try {
    const body = JSON.parse(text);
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}

export function formatErrorBody(text: string): string {
  try {
    const body = JSON.parse(text);
    if (Array.isArray(body?.issues) && body.issues.length > 0) {
      const details = body.issues
        .map((issue: { path?: unknown[]; message?: string }) => {
          const field = issue.path?.length ? `${issue.path.join(".")}: ` : "";
          return `${field}${issue.message ?? "invalide"}`;
        })
        .join("; ");
      return `${body.message ?? body.error ?? "Validation failed"} (${details})`;
    }
    if (typeof body?.message === "string") return body.message;
    if (typeof body?.error === "string") return body.error;
  } catch {
    // corps non JSON : conservé tel quel
  }
  return text;
}

// Un 401 sur une session ouverte (jeton expiré, compte supprimé, rôle changé) ferme la session
// locale et ramène à la connexion. Les 401 de /api/auth/login sont de simples identifiants invalides.
function endSessionOnUnauthorized(res: Response) {
  if (res.status !== 401 || !getAuthToken()) return;
  const path = new URL(res.url, window.location.origin).pathname;
  if (path === "/api/auth/login" || path === "/api/auth/register") return;
  removeAuthToken();
  window.location.href = "/";
}

async function throwIfResNotOk(res: Response) {
  endSessionOnUnauthorized(res);
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    const body = parseBody(text);
    const suffix = res.status >= 500 && body?.requestId ? ` (réf. ${String(body.requestId).slice(0, 8)})` : "";
    throw new ApiError(res.status, formatErrorBody(text) + suffix, body?.code, body?.reason, body?.requestId);
  }
}

function getAuthHeaders(): Headers {
  const token = localStorage.getItem("jwt_token");
  const headers = new Headers();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return headers;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<any> {
  const headers = new Headers(getAuthHeaders());

  if (data !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  if (res.status === 204) return null;
  return await res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      headers: getAuthHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
