import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

function GoogleAuth() {
    const navigate = useNavigate();

    async function GoogleAuth() {
        try{
        // send a auth request to server to know if user is authenticated or not 
        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
        const data = await fetch(`${API_URL}/auth/google`,{
            method:'GET',
            credentials: 'include'
        })
        const jsondata = await data.json();
        console.log(jsondata)
        if(jsondata.message !== 'User Loggedin'){
                navigate('/login')
            console.log('nav to login page')
        }else{
            // navigate('/log')

            console.log("nav to app")
        }
    }catch(e){
        console.log("UNABLE TO FETCH " + e)
    }}

    useEffect(()=>{
        GoogleAuth()
    },[])
    return <>
            
          
        </>
}

export default GoogleAuth;