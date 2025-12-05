// src/pages/DashboardPage.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, type ApiError } from "../api/client";
import { API_BASE_URL } from "../config";
import Spinner from "../components/Spinner";
import { useToast } from "../components/ToastProvider";

type HealthMap = Record<string, any>;

type SummaryResponse = {
  requested_by?: string;
  users?: any[];
  users_error?: string;
  products?: any[];
  products_error?: string;
  orders?: any[];
  orders_error?: string;
};

const DashboardPage = () => {
  const [health, setHealth] = useState<HealthMap | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setHealthError(null);
      setSummaryError(null);

      // /health (не защищён, но оставим обработку)
      try {
        const h = await apiGet<HealthMap>("/health");
        setHealth(h);
      } catch (err) {
        const e = err as ApiError;
        setHealthError(e.message || "Ошибка запроса /health");
        if (e.status === 401) {
          showToast({
            type: "error",
            message: "Сессия истекла, войдите заново",
          });
          navigate("/login", { replace: true, state: { from: "/" } });
          setLoading(false);
          return;
        }
      }

      // /summary (защищён JWT)
      try {
        const s = await apiGet<SummaryResponse>("/summary");
        setSummary(s);
      } catch (err) {
        const e = err as ApiError;
        setSummaryError(e.message || "Ошибка запроса /summary");
        if (e.status === 401) {
          showToast({
            type: "error",
            message: "Сессия истекла, войдите заново",
          });
          navigate("/login", { replace: true, state: { from: "/" } });
          setLoading(false);
          return;
        }
      }

      setLoading(false);
    };

    load();
  }, [navigate, showToast]);

  const serviceCards = (() => {
    if (!health) return [];
    return Object.entries(health).map(([name, value]) => {
      const status =
        typeof value === "string"
          ? value
          : value?.status ?? "unknown";

      const responseTimeMs =
        typeof value === "object" ? value.response_time_ms : undefined;

      return {
        name,
        status,
        responseTimeMs,
      };
    });
  })();

  const getStatusColor = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized === "ok") return "#22c55e";
    if (normalized === "degraded") return "#eab308";
    return "#ef4444";
  };

  const usersCount =
    summary && Array.isArray(summary.users) ? summary.users.length : null;
  const productsCount =
    summary && Array.isArray(summary.products) ? summary.products.length : null;
  const ordersCount =
    summary && Array.isArray(summary.orders) ? summary.orders.length : null;

  return (
    <div>
      <h2>Dashboard</h2>
      <p style={{ color: "#9ca3af", marginBottom: "1.5rem" }}>
        Обзор состояния микросервисов SmartHub и основных данных.
      </p>

      <div
        style={{
          fontSize: "0.85rem",
          color: "#6b7280",
          marginBottom: "1rem",
        }}
      >
        API_BASE_URL: <code>{API_BASE_URL}</code>
      </div>

      {loading && (
        <div className="page-loader">
          <Spinner />
          <span>Загружаем данные с gateway...</span>
        </div>
      )}

      {(healthError || summaryError) && (
        <div
          style={{
            background: "#7f1d1d",
            borderRadius: "0.75rem",
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            color: "#fecaca",
          }}
        >
          <strong>Проблемы с запросами:</strong>
          <ul style={{ margin: "0.5rem 0 0 1.2rem" }}>
            {healthError && <li>/health: {healthError}</li>}
            {summaryError && <li>/summary: {summaryError}</li>}
          </ul>
        </div>
      )}

      <section className="dashboard-section">
        <h3>Состояние сервисов</h3>
        <p style={{ color: "#9ca3af", marginBottom: "0.75rem" }}>
          Информация берётся из <code>GET /health</code> gateway.
        </p>

        {health && serviceCards.length > 0 ? (
          <div className="cards-grid">
            {serviceCards.map((svc) => (
              <div key={svc.name} className="card">
                <div className="card-title">{svc.name}</div>
                <div
                  className="card-status"
                  style={{ color: getStatusColor(svc.status) }}
                >
                  {svc.status}
                </div>
                {typeof svc.responseTimeMs === "number" && (
                  <div className="card-meta">
                    response_time: {svc.responseTimeMs.toFixed(2)} ms
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : !loading && !health ? (
          <p style={{ color: "#fca5a5" }}>
            Нет данных по /health. Проверьте работу gateway.
          </p>
        ) : null}
      </section>

      <section className="dashboard-section">
        <h3>Сводка данных</h3>
        <p style={{ color: "#9ca3af", marginBottom: "0.75rem" }}>
          Информация берётся из <code>GET /summary</code> gateway.
        </p>

        {summary && summary.requested_by && (
          <p
            style={{
              fontSize: "0.9rem",
              color: "#6b7280",
              marginBottom: "0.75rem",
            }}
          >
            Запрос выполнен от пользователя:{" "}
            <span style={{ color: "#e5e7eb" }}>{summary.requested_by}</span>
          </p>
        )}

        {summary ? (
          <div className="cards-grid">
            <div className="card">
              <div className="card-title">Users</div>
              {summary.users_error ? (
                <div className="card-error">
                  Ошибка: {summary.users_error}
                </div>
              ) : (
                <>
                  <div className="card-big-number">
                    {usersCount !== null ? usersCount : "—"}
                  </div>
                  <div className="card-meta">пользователей</div>
                </>
              )}
            </div>

            <div className="card">
              <div className="card-title">Products</div>
              {summary.products_error ? (
                <div className="card-error">
                  Ошибка: {summary.products_error}
                </div>
              ) : (
                <>
                  <div className="card-big-number">
                    {productsCount !== null ? productsCount : "—"}
                  </div>
                  <div className="card-meta">товаров</div>
                </>
              )}
            </div>

            <div className="card">
              <div className="card-title">Orders</div>
              {summary.orders_error ? (
                <div className="card-error">
                  Ошибка: {summary.orders_error}
                </div>
              ) : (
                <>
                  <div className="card-big-number">
                    {ordersCount !== null ? ordersCount : "—"}
                  </div>
                  <div className="card-meta">заказов</div>
                </>
              )}
            </div>
          </div>
        ) : !loading && !summary ? (
          <p style={{ color: "#fca5a5" }}>
            Нет данных по /summary. Проверьте авторизацию и работу gateway.
          </p>
        ) : null}
      </section>
    </div>
  );
};

export default DashboardPage;
