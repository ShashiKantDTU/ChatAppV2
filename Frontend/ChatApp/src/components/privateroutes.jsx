import { useContext } from "react";
import { AuthContext } from "./authcontext/authcontext";
import { Navigate } from "react-router-dom";

const PrivateRoute = ({ children }) => {

    const authcontext = useContext(AuthContext);
    if(!authcontext){
        return <Navigate to="/login" />;
    }
    const { user } = authcontext;
    return user ? children : <Navigate to="/login" />;
};

export default PrivateRoute;
