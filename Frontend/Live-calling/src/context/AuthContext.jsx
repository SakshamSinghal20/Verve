import { createContext, useState, useEffect } from "react";

export const AuthContext = createContext();

const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function verifyToken() {
            const token = localStorage.getItem("verve-token");
            if (!token) {
                setLoading(false);
                return;
            }

            try {
                const res = await fetch(`${API_URL}/api/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (!res.ok) {
                    throw new Error("Token invalid");
                }

                const data = await res.json();
                setUser(data.user);
            } catch (err) {
                console.error("Auth verification failed:", err);
                localStorage.removeItem("verve-token");
                localStorage.removeItem("verve-user");
                setUser(null);
            } finally {
                setLoading(false);
            }
        }

        verifyToken();
    }, []);

    const login = async (email, password) => {
        const res = await fetch(`${API_URL}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Login failed");

        localStorage.setItem("verve-token", data.token);
        localStorage.setItem("verve-user", JSON.stringify(data.user));
        setUser(data.user);
    };

    const register = async (name, email, password) => {
        const res = await fetch(`${API_URL}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Registration failed");

        localStorage.setItem("verve-token", data.token);
        localStorage.setItem("verve-user", JSON.stringify(data.user));
        setUser(data.user);
    };

    const logout = () => {
        localStorage.removeItem("verve-token");
        localStorage.removeItem("verve-user");
        setUser(null);
        window.location.href = "/";
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}
