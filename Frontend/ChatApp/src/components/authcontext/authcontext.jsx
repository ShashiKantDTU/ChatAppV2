import { createContext, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";


export const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true); // 🔹 Loading state
    const location = useLocation();
    const navigate = useNavigate()

    // 🔹 Skip authentication check for login & signup pages
    const excludedPaths = ['/login', '/signup'];

    useEffect(() => {
        if (excludedPaths.includes(location.pathname)) {
            setLoading(false); // Don't check auth, just render page
            return;
        }

        const fetchUser = async (retryCount = 0) => {
            try {
                const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
                console.log(`Attempting to fetch user authentication (attempt ${retryCount + 1})`);
                
                const response = await fetch(`${API_URL}/me`, {
                    credentials: "include", // Allows sending cookies
                });

                const data = await response.json();
                
                if (data.user) {
                    console.log("User authenticated:", data.user);
                    setUser(data.user);
                    setLoading(false);
                    navigate('/') // navigate to home page if userdata recieved
                } else if (retryCount < 1) {
                    // Retry once after a short delay if auth failed
                    // This handles race conditions with cookie setting
                    console.log("Auth check failed, retrying in 500ms...");
                    setTimeout(() => fetchUser(retryCount + 1), 500);
                    return; // Don't finish loading yet
                } else {
                    console.log("User not authenticated after retry");
                }
            } catch (error) {
                console.log("Error checking authentication:", error);
            } finally {
                // Only set loading to false if we're not going to retry
                if (retryCount > 0) {
                    setLoading(false);
                }
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
