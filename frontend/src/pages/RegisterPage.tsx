// src/pages/RegisterPage.tsx
import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AUTH_BASE_URL } from "../config";
import { useToast } from "../components/ToastProvider";

const RegisterPage = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username || !email || !password) {
      setError("Заполните все поля");
      return;
    }

    try {
      setLoading(true);

      // 1. Регистрируем пользователя
      const res = await fetch(`${AUTH_BASE_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const data = await res.json();
          if (typeof data.detail === "string") {
            msg = data.detail;
          }
        } catch {
          // ignore
        }
        throw new Error(msg);
      }

      // 2. Авто-логин
      const loginRes = await fetch(`${AUTH_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!loginRes.ok) {
        throw new Error(`Ошибка авто-входа (HTTP ${loginRes.status})`);
      }

      const loginData = await loginRes.json();
      localStorage.setItem("authToken", loginData.access_token);
      localStorage.setItem("authUsername", username);

      showToast({
        type: "success",
        message: "Аккаунт создан и выполнен вход",
      });

      navigate("/", { replace: true });
    } catch (err: any) {
      const msg = err?.message || "Ошибка регистрации";
      setError(msg);
      showToast({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at top, #0f172a, #020617)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          background: "#020617",
          borderRadius: "1rem",
          padding: "1.75rem 2rem",
          boxShadow: "0 24px 60px rgba(15,23,42,0.9)",
          border: "1px solid #1f2937",
        }}
      >
        <div style={{ marginBottom: "1.5rem", textAlign: "center" }}>
          <div
            style={{
              fontSize: "0.8rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#6b7280",
              marginBottom: "0.25rem",
            }}
          >
            SmartHub Admin
          </div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 600 }}>
            Регистрация
          </h1>
          <p
            style={{
              color: "#9ca3af",
              fontSize: "0.9rem",
              marginTop: "0.25rem",
            }}
          >
            Создайте новый аккаунт, чтобы войти в панель управления.
          </p>
        </div>

        {error && (
          <div
            style={{
              background: "#7f1d1d",
              borderRadius: "0.75rem",
              padding: "0.75rem 1rem",
              marginBottom: "1rem",
              color: "#fecaca",
              fontSize: "0.9rem",
            }}
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.25rem",
                fontSize: "0.9rem",
              }}
            >
              Username
            </label>
            <input
              type="text"
              value={username}
              autoComplete="username"
              onChange={(e) => setUsername(e.target.value)}
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #374151",
                background: "#020617",
                color: "#e5e7eb",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.25rem",
                fontSize: "0.9rem",
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #374151",
                background: "#020617",
                color: "#e5e7eb",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.25rem",
                fontSize: "0.9rem",
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #374151",
                background: "#020617",
                color: "#e5e7eb",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "0.75rem",
              padding: "0.7rem 0.75rem",
              borderRadius: "0.7rem",
              border: "none",
              background: loading ? "#22c55eaa" : "#22c55e",
              color: "white",
              fontWeight: 500,
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "Создаём аккаунт..." : "Зарегистрироваться"}
          </button>
        </form>

        <div
          style={{
            marginTop: "1rem",
            fontSize: "0.85rem",
            color: "#9ca3af",
            textAlign: "center",
          }}
        >
          Уже есть аккаунт?{" "}
          <Link
            to="/login"
            style={{ color: "#60a5fa", textDecoration: "none" }}
          >
            Войти
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
