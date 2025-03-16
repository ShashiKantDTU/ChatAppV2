import { createContext, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Authloading from "../Loading/Authloading";


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
                const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
                console.log(`Attempting to fetch user authentication (attempt ${retryCount + 1})`);
                console.log('API URL:', API_URL);
                
                // Get token from localStorage if available
                const token = localStorage.getItem('auth_token');
                console.log('Auth token from localStorage:', token ? 'Token exists' : 'No token');
                
                // Add explicit headers for better cross-domain cookie handling
                const headers = {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                };
                
                // Add Authorization header if token exists
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                    console.log('Added token to Authorization header');
                }
                
                const response = await fetch(`${API_URL}/me`, {
                    method: 'GET',
                    credentials: "include", // Essential for cross-domain cookies
                    headers: headers
                });

                console.log('Auth response status:', response.status);
                const data = await response.json();
                console.log('Auth response data:', data);
                
                if (data.user) {
                    console.log("User authenticated:", data.user);
                    setUser(data.user);
                    setLoading(false);
                } else if (retryCount < 2) { // Increase retry attempts
                    // Retry with exponential backoff
                    const delay = 500 * Math.pow(2, retryCount);
                    console.log(`Auth check failed, retrying in ${delay}ms...`);
                    setTimeout(() => fetchUser(retryCount + 1), delay);
                    return; // Don't finish loading yet
                } else {
                    console.log("User not authenticated after retries");
                    setLoading(false);
                    navigate('/login'); // Navigate to login if auth fails
                }
            } catch (error) {
                console.log("Error checking authentication:", error);
                if (retryCount < 2) { // Also retry on errors
                    const delay = 500 * Math.pow(2, retryCount);
                    console.log(`Auth check error, retrying in ${delay}ms...`);
                    setTimeout(() => fetchUser(retryCount + 1), delay);
                    return;
                } else {
                    setLoading(false);
                    navigate('/login');
                }
            }
        };

        fetchUser();
    }, [location.pathname]); // Runs when route changes

    // 🔹 Show loading screen while checking auth
    if (loading) {
        return <Authloading/>;
    }

    return (
        <AuthContext.Provider value={{ user, setUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthProvider;
