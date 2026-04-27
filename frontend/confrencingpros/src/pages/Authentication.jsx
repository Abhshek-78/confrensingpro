import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./Authentication.css";
import logo from "../utils/confreneview.png";

const API_BASE_URL = "http://127.0.0.1:8000/api/v1/users";

export default function Authentication() {
  const navigate = useNavigate();
  const [formType, setFormType] = useState("signup");
  const [form, setForm] = useState({
    name: "",
    username: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleRegister = async (name, username, password) => {
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE_URL}/register`, {
        name,
        username,
        password
      });

      if (response.status === 201) {
        return response.data.message;
      }
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (username, password) => {
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE_URL}/login`, {
        username,
        password
      });

      if (response.status === 200) {
        if (response.data.token) {
          localStorage.setItem("token", response.data.token);
        }

        navigate("/");
        return response.data.message || "Login successful";
      }
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const getPasswordStrength = () => {
    const password = form.password;
    if (!password) return { score: 0, label: "", color: "" };

    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[!@#$%^&*]/.test(password)) strength++;

    const strengthMap = {
      0: { label: "Very Weak", color: "#ff6b6b" },
      1: { label: "Weak", color: "#fa5252" },
      2: { label: "Fair", color: "#ffa94d" },
      3: { label: "Good", color: "#74b9ff" },
      4: { label: "Strong", color: "#55efc4" },
      5: { label: "Very Strong", color: "#00b894" }
    };

    return { score: strength, ...strengthMap[strength] };
  };

  const validate = () => {
    const newErrors = {};

    if (formType === "signup" && !form.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!form.username.trim()) {
      newErrors.username = "Username is required";
    }

    if (formType === "signup" && form.username.length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    }

    if (formType === "signup") {
      const strength = getPasswordStrength().score;
      if (strength < 3) {
        newErrors.password = "Password must be at least 8 characters with uppercase, lowercase, number, and special character";
      }
    } else if (form.password.length < 8) {
      newErrors.password = "Min 8 characters";
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validate();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      if (formType === "signup") {
        const result = await handleRegister(form.name, form.username, form.password);
        alert(result || "Account Created!");
        setForm({ name: "", username: "", password: "" });
        setFormType("signin");
      } else {
        const result = await handleLogin(form.username, form.password);
        alert(result || "Login Successful!");
      }
    } catch (error) {
      const msg = error?.response?.data?.message || "Something went wrong";
      alert(msg);
    }
  };

  const switchToSignin = () => {
    setFormType("signin");
    setForm({ name: "", username: "", password: "" });
    setErrors({});
  };

  const switchToSignup = () => {
    setFormType("signup");
    setForm({ name: "", username: "", password: "" });
    setErrors({});
  };

  return (
    <div className="container">
      <div className="logo">
        <img src={logo} alt="logo" />
      </div>

      <div className="form-box">
        <h2>
          {formType === "signup" ? (
            <>
              Sign <span>Up</span>
            </>
          ) : (
            "Sign In"
          )}
        </h2>

        <form onSubmit={handleSubmit}>
          {formType === "signup" && (
            <div>
              <input
                name="name"
                placeholder="Name"
                value={form.name}
                onChange={handleChange}
              />
              {errors.name && <p className="error">{errors.name}</p>}
            </div>
          )}

          <div>
            <input
              name="username"
              placeholder="Username"
              value={form.username}
              onChange={handleChange}
            />
            {errors.username && <p className="error">{errors.username}</p>}
          </div>

          <div>
            <input
              name="password"
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
            />
            {formType === "signup" && form.password && (
              <div style={{ marginTop: "8px" }}>
                <div style={{ fontSize: "12px", marginBottom: "5px" }}>
                  Strength: <span style={{ color: getPasswordStrength().color, fontWeight: "bold" }}>
                    {getPasswordStrength().label}
                  </span>
                </div>
                <div style={{ 
                  width: "100%", 
                  height: "6px", 
                  backgroundColor: "#e0e0e0", 
                  borderRadius: "3px",
                  overflow: "hidden"
                }}>
                  <div style={{
                    width: `${(getPasswordStrength().score / 5) * 100}%`,
                    height: "100%",
                    backgroundColor: getPasswordStrength().color,
                    transition: "width 0.3s ease"
                  }}></div>
                </div>
                <div style={{ fontSize: "11px", color: "#666", marginTop: "8px", lineHeight: "1.4" }}>
                  <div>✓ At least 8 characters {form.password.length >= 8 ? "✓" : "✗"}</div>
                  <div>✓ Uppercase letter {/[A-Z]/.test(form.password) ? "✓" : "✗"}</div>
                  <div>✓ Lowercase letter {/[a-z]/.test(form.password) ? "✓" : "✗"}</div>
                  <div>✓ Number {/[0-9]/.test(form.password) ? "✓" : "✗"}</div>
                  <div>✓ Special character (!@#$%^&*) {/[!@#$%^&*]/.test(form.password) ? "✓" : "✗"}</div>
                </div>
              </div>
            )}
            {errors.password && <p className="error">{errors.password}</p>}
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Loading..." : (formType === "signup" ? "Create Account" : "Login")}
          </button>
        </form>

        {/* TEXT TOGGLE */}
        <div className="toggle-text">
          <span
            className={formType === "signin" ? "active" : ""}
            onClick={switchToSignin}
          >
            Sign In
          </span>

          <span className="divider"> | </span>

          <span
            className={formType === "signup" ? "active" : ""}
            onClick={switchToSignup}
          >
            Sign Up
          </span>
        </div>
      </div>
    </div>
  );
}