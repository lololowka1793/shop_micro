// src/hooks/useAuth.ts

/**
 * Простой доступ к данным авторизации из localStorage.
 * Ожидаем ключи:
 *  - authToken
 *  - authUsername
 *  - authRole
 */
export function useAuth() {
  const token = localStorage.getItem("authToken");
  const username = localStorage.getItem("authUsername");
  const role = localStorage.getItem("authRole") || "user";

  const isAuthenticated = Boolean(token);

  const logout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUsername");
    localStorage.removeItem("authRole");
  };

  return {
    token,
    username,
    role,
    isAuthenticated,
    logout,
  };
}
