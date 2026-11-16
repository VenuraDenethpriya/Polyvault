import { createContext, useContext, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "./api.js";

const Ctx = createContext();
export const useAuth = () => useContext(Ctx);
export function Provider({ children }) {
  const [user, setUser] = useState(null),
    [ready, setReady] = useState(false),
    [favs, setFavs] = useState(() => {
      try {
        return JSON.parse(localStorage.favs || "[]");
      } catch {
        return [];
      }
    });
  useEffect(() => {
    (localStorage.t
      ? api("/me")
          .then(setUser)
          .catch(() => localStorage.removeItem("t"))
      : Promise.resolve()
    ).finally(() => setReady(true));
  }, []);
  useEffect(() => {
    localStorage.favs = JSON.stringify(favs);
  }, [favs]);
  // ids of assets the user has bought
  const [owned, setOwned] = useState([]);
  useEffect(() => {
    if (!user) return setOwned([]);
    api("/purchases")
      .then((r) => setOwned(r.map((p) => p.asset_id)))
      .catch(() => setOwned([]));
  }, [user?.id]);
  const buy = async (id, card) => {
    const p = await api(`/assets/${id}/buy`, { method: "POST", body: card });
    setOwned((o) => [...new Set([...o, p.asset_id])]);
    return p;
  };
  const login = async (path, body) => {
    const d = await api(path, { method: "POST", body });
    localStorage.t = d.token;
    setUser(d.user);
  };
  const logout = () => {
    localStorage.removeItem("t");
    setUser(null);
  };
  const toggleFav = (id) =>
    setFavs((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  return (
    <Ctx.Provider
      value={{
        user,
        setUser,
        ready,
        login,
        logout,
        favs,
        toggleFav,
        owned,
        buy,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
export const Guard = ({ roles, children }) => {
  const { user, ready } = useAuth();
  return !ready ? null : !user ? (
    <Navigate to="/login" />
  ) : roles && !roles.includes(user.role) ? (
    <Navigate to="/" />
  ) : (
    children
  );
};
