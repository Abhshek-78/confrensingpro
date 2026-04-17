import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import userRoutes from "./route/userRoute.js";
import { connectToSocket } from "./controller/socketManager.js";
const app = express();
const server = createServer(app); // connect app to server
const io = connectToSocket(server);

const PORT = process.env.PORT || 8000;
app.use(cors());
app.use(express.json({limit:"40kb"}));
app.use(express.urlencoded({limit:"40kb",extended:true}))
app.set("port", PORT);
app.use("/api/v1/users",userRoutes) // this type we create multiple if you give new updade to user cant change in older versiion if he cant



const start = async () => {
    app.set("mongoose user");
    try {
      const connectinDb=await mongoose.connect(
        "mongodb+srv://javacss77_db_user:bUqmNKYeWvXDFvAY@cluster2.ei0cttg.mongodb.net/",
        {
          retryWrites: false,
          ssl: true,
          tlsAllowInvalidCertificates: true,
          socketTimeoutMS: 45000,
          serverSelectionTimeoutMS: 10000,
        }
      );
      console.log(`connecton mongo  db host ${connectinDb.connection.host}`)
    } catch (dbError) {
      console.error("MongoDB connection failed:", dbError.message);
      console.log("Server will run without database for now");
    }
    
  server.listen(app.get("port"), () => {
    console.log(`Server running at http://127.0.0.1:${PORT}`);
    console.log(`Available routes: POST /api/v1/users/login, POST /api/v1/users/register, GET /api/v1/users/home`);
  });
};

start();