// src/pages/UsersPage.tsx
import { FormEvent, useEffect, useState } from "react";
import { USERS_BASE_URL } from "../config";

type User = {
  id: number;
  username: string;
  email?: string | null;
};

const UsersPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${USERS_BASE_URL}/users`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as User[];
      setUsers(data);
    } catch (err: any) {
      setError(err?.message || "Не удалось загрузить пользователей");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!username) {
      setCreateError("Введите username");
      return;
    }

    try {
      setCreating(true);

      const res = await fetch(`${USERS_BASE_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          email: email || null,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      // Можно взять созданного пользователя, но проще просто обновить список
      await loadUsers();

      setUsername("");
      setEmail("");
    } catch (err: any) {
      setCreateError(err?.message || "Ошибка при создании пользователя");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <h2>Users</h2>
      <p style={{ color: "#9ca3af", marginBottom: "1rem" }}>
        Управление пользователями сервиса SmartHub. Данные берутся напрямую из
        сервиса users (<code>{USERS_BASE_URL}</code>).
      </p>

      {/* Ошибка загрузки списка */}
      {error && (
        <div className="alert-error">
          <strong>Ошибка загрузки пользователей:</strong> {error}
        </div>
      )}

      {/* Список пользователей */}
      <section className="dashboard-section">
        <h3>Список пользователей</h3>

        {loading ? (
          <p>Загрузка...</p>
        ) : users.length === 0 ? (
          <p style={{ color: "#9ca3af" }}>Пользователей пока нет.</p>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td>{u.username}</td>
                    <td>{u.email || <span style={{ color: "#6b7280" }}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Форма создания */}
      <section className="dashboard-section">
        <h3>Создать пользователя</h3>
        <p style={{ color: "#9ca3af" }}>
          Минимум требуется username. Email можно оставить пустым.
        </p>

        {createError && (
          <div className="alert-error">
            <strong>Ошибка:</strong> {createError}
          </div>
        )}

        <form
          onSubmit={handleCreate}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            maxWidth: 400,
            marginTop: "0.75rem",
          }}
        >
          <div>
            <label style={{ display: "block", marginBottom: "0.25rem" }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #374151",
                background: "#020617",
                color: "#e5e7eb",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.25rem" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #374151",
                background: "#020617",
                color: "#e5e7eb",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={creating}
            style={{
              marginTop: "0.5rem",
              padding: "0.6rem 0.75rem",
              borderRadius: "0.5rem",
              border: "none",
              background: creating ? "#1d4ed8aa" : "#1d4ed8",
              color: "white",
              fontWeight: 500,
              cursor: creating ? "default" : "pointer",
              alignSelf: "flex-start",
            }}
          >
            {creating ? "Создаём..." : "Создать"}
          </button>
        </form>
      </section>
    </div>
  );
};

export default UsersPage;
