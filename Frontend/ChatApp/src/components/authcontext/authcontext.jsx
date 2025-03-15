import { createContext, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

export const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true); // 🔹 Loading state
    const location = useLocation();

    // 🔹 Skip authentication check for login & signup pages
    const excludedPaths = ['/login', '/signup'];

    useEffect(() => {
        if (excludedPaths.includes(location.pathname)) {
            setLoading(false); // Don't check auth, just render page
            return;
        }

        const fetchUser = async () => {
            try {
                const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
                const response = await fetch(`${API_URL}/me`, {
                    credentials: "include", // Allows sending cookies
                });

                const data = await response.json();
                
                if (data.user) {
                    // console.log("User authenticated:", data.user);
                    setUser(data.user);
                }
            } catch (error) {
                console.log("User not authenticated" , error);
            } finally {
                setLoading(false); // 🔹 Stop loading after fetch
            }
        };

        fetchUser();
    }, [location.pathname]); // Runs when route changes

    // 🔹 Show loading screen while checking auth
    if (loading) {
        return <div className="loading-screen">Loading...</div>;
    }

    return (
        <AuthContext.Provider value={{ user, setUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthProvider;
