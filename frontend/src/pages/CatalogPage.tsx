// src/pages/CatalogPage.tsx
import { FormEvent, useEffect, useState } from "react";
import { CATALOG_BASE_URL } from "../config";

type Product = {
  id: number;
  name: string;
  price: number;
  in_stock: boolean;
};

const CatalogPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [inStock, setInStock] = useState(true);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${CATALOG_BASE_URL}/products`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as Product[];
      setProducts(data);
    } catch (err: any) {
      setError(err?.message || "Не удалось загрузить товары");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!name) {
      setCreateError("Введите имя товара");
      return;
    }

    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue <= 0) {
      setCreateError("Введите корректную цену (> 0)");
      return;
    }

    try {
      setCreating(true);

      const res = await fetch(`${CATALOG_BASE_URL}/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          price: priceValue,
          in_stock: inStock,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      await loadProducts();

      setName("");
      setPrice("");
      setInStock(true);
    } catch (err: any) {
      setCreateError(err?.message || "Ошибка при создании товара");
    } finally {
      setCreating(false);
    }
  };

  const renderStock = (value: boolean) => {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.25rem",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "999px",
            background: value ? "#22c55e" : "#ef4444",
          }}
        />
        {value ? "в наличии" : "нет в наличии"}
      </span>
    );
  };

  return (
    <div>
      <h2>Catalog</h2>
      <p style={{ color: "#9ca3af", marginBottom: "1rem" }}>
        Управление товарами SmartHub. Данные берутся напрямую из сервиса
        catalog (<code>{CATALOG_BASE_URL}</code>).
      </p>

      {error && (
        <div className="alert-error">
          <strong>Ошибка загрузки товаров:</strong> {error}
        </div>
      )}

      {/* Список товаров */}
      <section className="dashboard-section">
        <h3>Список товаров</h3>

        {loading ? (
          <p>Загрузка...</p>
        ) : products.length === 0 ? (
          <p style={{ color: "#9ca3af" }}>Товаров пока нет.</p>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Название</th>
                  <th>Цена</th>
                  <th>Наличие</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.name}</td>
                    <td>{p.price.toFixed(2)}</td>
                    <td>{renderStock(p.in_stock)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Форма создания товара */}
      <section className="dashboard-section">
        <h3>Создать товар</h3>
        <p style={{ color: "#9ca3af" }}>
          Укажите название, цену и наличие товара.
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
              Название
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
              Цена
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
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
            <label style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={inStock}
                onChange={(e) => setInStock(e.target.checked)}
              />
              <span>В наличии</span>
            </label>
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

export default CatalogPage;
