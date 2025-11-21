import type { User } from "@shared/schema";

const TOKEN_KEY = "jwt_token";
const USER_KEY = "current_user";

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getCurrentUser(): Omit<User, "password"> | null {
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function setCurrentUser(user: Omit<User, "password">): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

export function isMentor(): boolean {
  const user = getCurrentUser();
  return user?.role === "MENTOR";
}

export function isLearner(): boolean {
  const user = getCurrentUser();
  return user?.role === "LEARNER";
}

export function logout(): void {
  removeAuthToken();
  window.location.href = "/";
}
