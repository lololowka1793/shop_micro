// src/pages/OrdersPage.tsx
import { FormEvent, useEffect, useState } from "react";
import {
  ORDERS_BASE_URL,
  USERS_BASE_URL,
  CATALOG_BASE_URL,
} from "../config";
import { useToast } from "../components/ToastProvider";

type OrderItem = {
  product_id: number;
  quantity: number;
};

type Order = {
  id: number;
  user_id: number;
  status: string;
  items: OrderItem[];
};

type User = {
  id: number;
  username: string;
};

type Product = {
  id: number;
  name: string;
};

const OrdersPage = () => {
  const { showToast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [productsError, setProductsError] = useState<string | null>(null);

  const [userId, setUserId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadOrders = async () => {
    try {
      setOrdersLoading(true);
      setOrdersError(null);

      const res = await fetch(`${ORDERS_BASE_URL}/orders`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as Order[];
      setOrders(data);
    } catch (err: any) {
      const msg = err?.message || "Не удалось загрузить заказы";
      setOrdersError(msg);
      showToast({ type: "error", message: `Ошибка загрузки заказов: ${msg}` });
    } finally {
      setOrdersLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      setUsersError(null);
      const res = await fetch(`${USERS_BASE_URL}/users`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as User[];
      setUsers(data);
    } catch (err: any) {
      const msg = err?.message || "Не удалось загрузить пользователей";
      setUsersError(msg);
      showToast({ type: "error", message: `Ошибка загрузки пользователей: ${msg}` });
    }
  };

  const loadProducts = async () => {
    try {
      setProductsError(null);
      const res = await fetch(`${CATALOG_BASE_URL}/products`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as Product[];
      setProducts(data);
    } catch (err: any) {
      const msg = err?.message || "Не удалось загрузить товары";
      setProductsError(msg);
      showToast({ type: "error", message: `Ошибка загрузки товаров: ${msg}` });
    }
  };

  useEffect(() => {
    loadOrders();
    loadUsers();
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!userId) {
      setCreateError("Выберите пользователя");
      return;
    }
    if (!productId) {
      setCreateError("Выберите товар");
      return;
    }

    const userIdNum = parseInt(userId, 10);
    const productIdNum = parseInt(productId, 10);
    const qtyNum = parseInt(quantity, 10);

    if (isNaN(qtyNum) || qtyNum <= 0) {
      setCreateError("Количество должно быть > 0");
      return;
    }

    try {
      setCreating(true);

      const res = await fetch(`${ORDERS_BASE_URL}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userIdNum,
          items: [
            {
              product_id: productIdNum,
              quantity: qtyNum,
            },
          ],
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      await loadOrders();

      showToast({
        type: "success",
        message: "Заказ создан успешно",
      });

      setUserId("");
      setProductId("");
      setQuantity("1");
    } catch (err: any) {
      const msg = err?.message || "Ошибка при создании заказа";
      setCreateError(msg);
      showToast({
        type: "error",
        message: msg,
      });
    } finally {
      setCreating(false);
    }
  };

  const getUserLabel = (id: number) => {
    const u = users.find((x) => x.id === id);
    return u ? `${u.username} (id=${u.id})` : `User #${id}`;
  };

  const getProductLabel = (id: number) => {
    const p = products.find((x) => x.id === id);
    return p ? `${p.name} (id=${p.id})` : `Product #${id}`;
  };

  const getStatusClass = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("new") || s.includes("created") || s === "ok") {
      return "badge-status badge-status-ok";
    }
    if (s.includes("fail") || s.includes("error")) {
      return "badge-status badge-status-error";
    }
    return "badge-status badge-status-pending";
  };

  return (
    <div>
      <h2>Orders</h2>
      <p style={{ color: "#9ca3af", marginBottom: "1rem" }}>
        Управление заказами SmartHub. Данные берутся напрямую из сервиса orders{" "}
        (<code>{ORDERS_BASE_URL}</code>).
      </p>

      {/* Общие ошибки загрузки */}
      {(ordersError || usersError || productsError) && (
        <div className="alert-error">
          <strong>Проблемы с загрузкой данных:</strong>
          <ul
            style={{
              marginTop: "0.4rem",
              marginBottom: 0,
              paddingLeft: "1.2rem",
            }}
          >
            {ordersError && <li>orders: {ordersError}</li>}
            {usersError && <li>users: {usersError}</li>}
            {productsError && <li>catalog: {productsError}</li>}
          </ul>
        </div>
      )}

      {/* Список заказов */}
      <section className="dashboard-section">
        <h3>Список заказов</h3>

        {ordersLoading ? (
          <p>Загрузка...</p>
        ) : orders.length === 0 ? (
          <p style={{ color: "#9ca3af" }}>Заказов пока нет.</p>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Пользователь</th>
                  <th>Статус</th>
                  <th>Позиции</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.id}</td>
                    <td>{getUserLabel(o.user_id)}</td>
                    <td>
                      <span className={getStatusClass(o.status)}>
                        <span className="badge-status-dot" />
                        {o.status}
                      </span>
                    </td>
                    <td>
                      {o.items && o.items.length > 0 ? (
                        <ul className="order-items-list">
                          {o.items.map((it, idx) => (
                            <li key={idx}>
                              {getProductLabel(it.product_id)} — qty:{" "}
                              {it.quantity}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span style={{ color: "#6b7280" }}>
                          нет позиций
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Создание заказа */}
      <section className="dashboard-section">
        <h3>Создать заказ</h3>
        <p style={{ color: "#9ca3af" }}>
          Выберите пользователя, товар и укажите количество. В демонстрационных
          целях заказ создаётся с одной позицией.
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
            maxWidth: 450,
            marginTop: "0.75rem",
          }}
        >
          {/* Пользователь */}
          <div>
            <label style={{ display: "block", marginBottom: "0.25rem" }}>
              Пользователь
            </label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #374151",
                background: "#020617",
                color: "#e5e7eb",
              }}
            >
              <option value="">— выберите пользователя —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username} (id={u.id})
                </option>
              ))}
            </select>
          </div>

          {/* Товар */}
          <div>
            <label style={{ display: "block", marginBottom: "0.25rem" }}>
              Товар
            </label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #374151",
                background: "#020617",
                color: "#e5e7eb",
              }}
            >
              <option value="">— выберите товар —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (id={p.id})
                </option>
              ))}
            </select>
          </div>

          {/* Количество */}
          <div>
            <label style={{ display: "block", marginBottom: "0.25rem" }}>
              Количество
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
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
            {creating ? "Создаём..." : "Создать заказ"}
          </button>
        </form>
      </section>
    </div>
  );
};

export default OrdersPage;
