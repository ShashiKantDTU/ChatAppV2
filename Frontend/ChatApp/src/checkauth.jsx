import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

function CheckAuth() {
    const navigate = useNavigate();

    async function checkauth() {
        try {
            // Send auth request to server using configured API URL
            const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
            console.log("Checking authentication against:", API_URL);
            
            const response = await fetch(`${API_URL}/`, {
                method: 'GET',
                credentials: 'include'
            });
            
            if (!response.ok) {
                console.log(`Auth check failed with status: ${response.status}`);
                navigate('/login');
                return;
            }
            
            const jsondata = await response.json();
            console.log("Auth check response:", jsondata);
            
            if (jsondata.message !== 'User Loggedin') {
                navigate('/login');
                console.log('Navigating to login page - not authenticated');
            } else {
                console.log('User is authenticated');
                // Do nothing, stay on current page
            }
        } catch (e) {
            console.log("Authentication check error:", e);
            navigate('/login');
        }
    }

    useEffect(() => {
        checkauth();
    }, []);
    
    return <></>;
}

export default CheckAuth;