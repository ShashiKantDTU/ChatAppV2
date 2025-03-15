import { useContext, useEffect } from "react";
import { AuthContext } from "./authcontext/authcontext";
import { useNavigate } from "react-router-dom";

const Logout = () => {
    const { logout } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        const performLogout = async () => {
            try {
                // Call the logout function from context
                await logout();
                
                // Navigate to login page
                navigate('/login');
            } catch (error) {
                console.error('Error during logout:', error);
                navigate('/login');
            }
        };

        performLogout();
    }, [logout, navigate]);

    return (
        <div className="loading-screen">
            <p>Logging out...</p>
        </div>
    );
};

export default Logout; 