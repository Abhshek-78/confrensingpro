import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 100
        },
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            minlength: 3,
            maxlength: 50,
            lowercase: true,
            match: /^[a-z0-9_-]+$/
        },
        password: {
            type: String,
            required: true,
            minlength: 8,
            select: true
        },
        token: {
            type: String,
            default: null
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    },
    { timestamps: true }
);


userSchema.pre("save", async function() {
    if (!this.isModified("password")) {
        return;
    }
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
        throw error;
    }
});


userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

const User = mongoose.model("User", userSchema);
export { User };