import express from "express";
import http from "http";
import bodyParser from "body-parser";
import morgan from "morgan";
import router from "./router.js";
import mongoose from "mongoose";

// Init
const port = process.env.port || 3090;
const app = express();

// DB Setup
mongoose.connect(
  `mongodb+srv://onespacecluster.gpwsx.mongodb.net/ctt_db?retryWrites=true&w=majority`,
  {
    user: process.env.MONGO_USER,
    pass: process.env.MONGO_PASSWORD,
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

//App Setup & Middleware
app.use(morgan("combined"));
app.use(bodyParser.json({ type: "*/*" }));
router(app);

//Server Setup
const server = http.createServer(app);
server.listen(port);
console.log("Server listening on", port);
