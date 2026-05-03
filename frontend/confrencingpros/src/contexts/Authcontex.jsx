import { createContext, useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export const Authcontext = createContext({});

const client = axios.create({
  baseURL: "http://127.0.0.1:8000/api/v1/users"
});

export const AuthProvider = ({ children }) => {

  const [userData, setUserdata] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useNavigate();

  // Check if user is already logged in on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        // You can verify token with backend here if needed
        setUserdata({ token });
      } catch (error) {
        console.error("Token verification failed:", error);
        localStorage.removeItem("token");
      }
    }
    setIsLoading(false);
  }, []);

  
  const handleRegister = async (name, username, password) => {
    try {
      const request = await client.post("/register", {
        name,
        username,
        password
      });

      if (request.status === 201) {
        return request.data.message;
      }

    } catch (error) {
      throw error;
    }
  };

  
  const handleLogin = async (username, password) => {
    try {
      const request = await client.post("/login", {
        username,
        password
      });

      if (request.status === 200) {
        
        setUserdata(request.data);

    
        if (request.data.token) {
          localStorage.setItem("token", request.data.token);
        }

        
        router("/");

        return request.data.message || "Login successful";
      }

    } catch (error) {
      throw error;
    }
  };

  const handleLogout = () => {
    setUserdata(null);
    localStorage.removeItem("token");
  };

  const data = {
    userData,
    setUserdata,
    handleRegister,
    handleLogin,
    handleLogout,
    isLoading
  };

  return (
    <Authcontext.Provider value={data}>
      {children}
    </Authcontext.Provider>
  );
};