import { createContext, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true); // 🔹 Loading state
    const location = useLocation();
    const navigate = useNavigate();

    // 🔹 Skip authentication check for login & signup pages
    const excludedPaths = ['/login', '/signup', '/logout'];

    // Function to handle user logout
    const logout = async () => {
        try {
            setLoading(true);
            const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
            await fetch(`${API_URL}/logout`, {
                method: 'POST',
                credentials: 'include',
            });
            
            // Clear user data regardless of server response
            setUser(null);
            
            // Redirect to login page
            navigate('/login');
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setLoading(false);
        }
    };

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

                if (!response.ok) {
                    // If response is not OK, token is invalid or expired
                    console.log("Authentication failed:", response.status);
                    setUser(null);
                    
                    // Only redirect if not already on an excluded path
                    if (!excludedPaths.includes(location.pathname)) {
                        navigate('/login');
                    }
                    return;
                }

                const data = await response.json();
                
                if (data.user) {
                    // console.log("User authenticated:", data.user);
                    setUser(data.user);
                } else {
                    setUser(null);
                    if (!excludedPaths.includes(location.pathname)) {
                        navigate('/login');
                    }
                }
            } catch (error) {
                console.log("User not authenticated" , error);
                setUser(null);
                
                // Only redirect if not already on an excluded path
                if (!excludedPaths.includes(location.pathname)) {
                    navigate('/login');
                }
            } finally {
                setLoading(false); // 🔹 Stop loading after fetch
            }
        };

        fetchUser();
    }, [location.pathname, navigate]); // Runs when route changes

    // 🔹 Show loading screen while checking auth
    if (loading) {
        return <div className="loading-screen">Loading...</div>;
    }

    return (
        <AuthContext.Provider value={{ user, setUser, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthProvider;
