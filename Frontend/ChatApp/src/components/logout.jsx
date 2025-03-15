import React, { useContext } from 'react';
import { AuthContext } from './authcontext/authcontext';

const Logout = () => {
    const { setUser } = useContext(AuthContext);

    const handleLogout = async () => {
        try {
            const response = await fetch('http://localhost:3000/logout', {
                method: 'POST',  // ✅ Logout should be a POST request
                credentials: 'include', // ✅ Ensures cookies are sent with the request
            });

            if (!response.ok) {
                throw new Error("Logout failed");
            }

            setUser(null);  // ✅ Clears user state after successful logout
            console.log("User logged out successfully");
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    return <button onClick={handleLogout}>Logout</button>;
};

export default Logout;
