// src/App.tsx
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  useNavigate,
} from "react-router-dom";
import "./App.css";

import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import UsersPage from "./pages/UsersPage";
import CatalogPage from "./pages/CatalogPage";
import OrdersPage from "./pages/OrdersPage";
import AdminHealthPage from "./pages/AdminHealthPage";
import { RequireAuth } from "./components/RequireAuth";
import { getAuthToken } from "./api/client";
import RegisterPage from "./pages/RegisterPage";


function Header() {
  const navigate = useNavigate();
  const token = getAuthToken();
  const username = localStorage.getItem("authUsername") || "";

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUsername");
    navigate("/login");
  };

  const handleLoginClick = () => {
    navigate("/login");
  };

  return (
    <header className="app-header">
      <div>
        <div className="app-header-title">SmartHub Admin</div>
        <div className="app-header-subtitle">
          Управление микросервисным магазином: gateway, auth, users, catalog,
          orders, notifications
        </div>
      </div>
      <div className="app-header-right">
        {token ? (
          <>
            <span className="app-header-user">
              {username ? `Пользователь: ${username}` : "Авторизован"}
            </span>
            <button className="logout-button" onClick={handleLogout}>
              Выйти
            </button>
          </>
        ) : (
          <button className="logout-button" onClick={handleLoginClick}>
            Войти
          </button>
        )}
      </div>
    </header>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="app-root">
        <Header />

        <div className="app-body">
          <nav className="app-nav">
            <NavLink
              to="/"
              className={({ isActive }) =>
                isActive ? "nav-link nav-link-active" : "nav-link"
              }
              end
            >
              Dashboard
            </NavLink>

            <NavLink
              to="/login"
              className={({ isActive }) =>
                isActive ? "nav-link nav-link-active" : "nav-link"
              }
            >
              Login
            </NavLink>

            <NavLink
              to="/users"
              className={({ isActive }) =>
                isActive ? "nav-link nav-link-active" : "nav-link"
              }
            >
              Users
            </NavLink>

            <NavLink
              to="/catalog"
              className={({ isActive }) =>
                isActive ? "nav-link nav-link-active" : "nav-link"
              }
            >
              Catalog
            </NavLink>

            <NavLink
              to="/orders"
              className={({ isActive }) =>
                isActive ? "nav-link nav-link-active" : "nav-link"
              }
            >
              Orders
            </NavLink>

            <NavLink
              to="/admin/health"
              className={({ isActive }) =>
                isActive ? "nav-link nav-link-active" : "nav-link"
              }
            >
              Admin / Health
            </NavLink>
          </nav>

          <main className="app-content">
            <Routes>
            <Route path="/register" element={<RegisterPage />} />
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <DashboardPage />
                  </RequireAuth>
                }
              />
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/users"
                element={
                  <RequireAuth>
                    <UsersPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/catalog"
                element={
                  <RequireAuth>
                    <CatalogPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/orders"
                element={
                  <RequireAuth>
                    <OrdersPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/admin/health"
                element={
                  <RequireAuth>
                    <AdminHealthPage />
                  </RequireAuth>
                }
              />
              <Route
                path="*"
                element={<div>404 – Страница не найдена</div>}
              />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
