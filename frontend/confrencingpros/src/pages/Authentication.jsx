import React, { useState, useContext } from "react";
import "./Authentication.css";
import logo from "../utils/confreneview.png";
import { Authcontext } from "../contexts/Authcontex";

export default function Authentication() {
  const { handleRegister, handleLogin } = useContext(Authcontext);
  const [formType, setFormType] = useState("signup");
  const [form, setForm] = useState({
    name: "",
    username: "",
    password: "",
  });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const validate = () => {
    const newErrors = {};

    if (formType === "signup" && !form.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!form.username.trim()) {
      newErrors.username = "Username is required";
    }

    if (form.password.length < 6) {
      newErrors.password = "Min 6 characters";
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
            {errors.password && <p className="error">{errors.password}</p>}
          </div>

          <button type="submit">
            {formType === "signup" ? "Create Account" : "Login"}
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