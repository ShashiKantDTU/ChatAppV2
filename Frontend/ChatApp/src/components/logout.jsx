import { useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './authcontext/authcontext';

function Logout() {
    const navigate = useNavigate();
    const { setUser } = useContext(AuthContext);

    useEffect(() => {
        async function performLogout() {
            try {
                // Get API URL from environment variable
                const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
                
                // Call the logout endpoint
                const response = await fetch(`${API_URL}/logout`, {
                    method: 'POST',
                    credentials: 'include',
                });

                if (response.ok) {
                    console.log("Logout successful");
                } else {
                    console.error("Logout failed:", await response.text());
                }
                
                // Clear user from context regardless of API response
                setUser(null);
                
                // Navigate to login page
                navigate('/login');
            } catch (error) {
                console.error("Error during logout:", error);
                // Still navigate to login and clear user state even if API call fails
                setUser(null);
                navigate('/login');
            }
        }

        performLogout();
    }, [navigate, setUser]);

    return (
        <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh',
            backgroundColor: '#1a1a2e'
        }}>
            <div style={{ 
                color: 'white', 
                fontSize: '20px',
                textAlign: 'center' 
            }}>
                <p>Logging you out...</p>
                <div style={{ 
                    margin: '20px auto',
                    border: '4px solid rgba(255, 255, 255, 0.3)',
                    borderTop: '4px solid #0984e3',
                    borderRadius: '50%',
                    width: '30px',
                    height: '30px',
                    animation: 'spin 1s linear infinite'
                }}></div>
                <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        </div>
    );
}

export default Logout; 