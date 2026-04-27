import { User } from "../models/userSchema.js";  
import httpStatus from "http-status"  
import bcrypt from "bcrypt";
import crypto from "crypto";

// Helper function to validate password strength
const validatePasswordStrength = (password) => {
  const errors = [];
  
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  if (!/[!@#$%^&*]/.test(password)) {
    errors.push("Password must contain at least one special character (!@#$%^&*)");
  }
  
  return errors;
};

const login=async (req,res)=>{
   const { username, password } = req.body;
   
   if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
   }
   
   try {
    const user = await User.findOne({ username: username.toLowerCase().trim() });
    
    if (!user) {
        return res.status(httpStatus.NOT_FOUND).json({ message: "Invalid username or password" });
    }
    
  
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
        return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid username or password" });
    }
    
    // Password is valid, generate token
    const token = crypto.randomBytes(20).toString("hex");
    user.token = token;
    await user.save();
    
    return res.status(httpStatus.OK).json({ 
      token: token,
      message: "Login successful"
    });

   } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Server error. Please try again later." });
   }
}

const register = async(req, res) => {
    const { name, username, password } = req.body;
    
    try {
        // Validate required fields
        if (!name || !username || !password) {
            return res.status(400).json({ message: "Name, username, and password are required" });
        }
      
        const trimmedName = name.trim();
        const trimmedUsername = username.trim();
        
       
        if (trimmedName.length < 2) {
            return res.status(400).json({ message: "Name must be at least 2 characters long" });
        }
        
        if (trimmedUsername.length < 3) {
            return res.status(400).json({ message: "Username must be at least 3 characters long" });
        }
        
        const passwordErrors = validatePasswordStrength(password);
        if (passwordErrors.length > 0) {
            return res.status(400).json({ 
                message: "Password does not meet security requirements",
                errors: passwordErrors 
            });
        }
        

        const existingUser = await User.findOne({ username: trimmedUsername.toLowerCase() });
        if (existingUser) {
            return res.status(httpStatus.CONFLICT).json({ message: "Username already exists. Please choose a different username." });
        }
        
       
        const newUser = new User({
            name: trimmedName,
            username: trimmedUsername.toLowerCase(),
            password: password
        });
        
        await newUser.save();
        res.status(httpStatus.CREATED).json({ message: "Account created successfully!" });
        
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ message: "Server error. Please try again later." });
    }
}

export {login,register};