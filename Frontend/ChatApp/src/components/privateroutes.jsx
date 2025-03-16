import { useContext, useEffect, useState } from "react";
import { AuthContext } from "./authcontext/authcontext";
import { Navigate } from "react-router-dom";
import Authloading from "./Loading/Authloading";

const PrivateRoute = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(null);
    const authContext = useContext(AuthContext);

    useEffect(() => {
        // Add a safety timeout to prevent infinite loading
        const safetyTimeout = setTimeout(() => {
            if (isAuthenticated === 'loading' || isAuthenticated === null) {
                console.log("PrivateRoute safety timeout triggered - forcing authentication state");
                setIsAuthenticated(false);
                localStorage.removeItem('auth_token');
            }
        }, 15000); // 15 seconds max loading time

        // Check if we have a token in localStorage even if authContext is null
        if (!authContext || !authContext.user) {
            const token = localStorage.getItem('auth_token');
            if (token) {
                // If token exists but user isn't in context yet, we're in a loading state
                setIsAuthenticated('loading');
                
                // Try to verify the token directly
                const checkToken = async () => {
                    try {
                        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
                        const response = await fetch(`${API_URL}/me`, {
                            method: 'GET',
                            credentials: 'include',
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        
                        if (response.ok) {
                            const data = await response.json();
                            if (data.user) {
                                setIsAuthenticated(true);
                                // Set user in context if available
                                if (authContext && authContext.setUser) {
                                    authContext.setUser(data.user);
                                }
                                return;
                            }
                        }
                        // If we get here, token is invalid
                        console.log("Token verification failed, removing token");
                        setIsAuthenticated(false);
                        localStorage.removeItem('auth_token');
                    } catch (error) {
                        console.error('Error verifying token:', error);
                        setIsAuthenticated(false);
                        localStorage.removeItem('auth_token');
                    }
                };
                
                checkToken();
            } else {
                setIsAuthenticated(false);
            }
        } else {
            // We have a user in the context
            setIsAuthenticated(true);
        }

        // Clear the safety timeout if component unmounts or dependencies change
        return () => clearTimeout(safetyTimeout);
    }, [authContext]);

    // Show loading while checking token
    if (isAuthenticated === 'loading' || isAuthenticated === null) {
        return <Authloading />;
    }

    // Redirect if not authenticated
    if (!isAuthenticated) {
        return <Navigate to="/login" />;
    }

    // User is authenticated
    return children;
};

export default PrivateRoute;
