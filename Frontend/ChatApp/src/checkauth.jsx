import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

function CheckAuth() {
    const navigate = useNavigate();

    async function checkauth() {
        try{
        // send a auth request to server to know if user is authenticated or not 
        const data = await fetch('http://localhost:3000/',{
            method:'GET',
            credentials: 'include'
        })
        const jsondata = await data.json();
        console.log(jsondata)
        if(jsondata.message !== 'User Loggedin'){
                navigate('/login')
            console.log('nav to login page')
        }else{
           
            // DO NOTHING

           
        }
    }catch(e){
        console.log("UNABLE TO FETCH " + e)
    }}

    useEffect(()=>{
        checkauth()
    },[])
    return <>
            
          
        </>
}

export default CheckAuth;