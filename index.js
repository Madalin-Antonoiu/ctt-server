import express from "express";
import http from "http";
import bodyParser from "body-parser";
import morgan from "morgan";
import router from "./router.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
// import redis from "redis";

dotenv.config();
const port = process.env.port || 3090;
const app = express();
const corsOptions = {
  origin: process.env.CORS_ALLOWED_ORIGIN,
  optionsSuccessStatus: 200,
  methods: "POST",
};
// const redisOptions = {
//   host: "replica.redis-node-binance.enp13j.euw2.cache.amazonaws.com",
//   port: 6379,
// };
// const client = redis.createClient(redisOptions);

// DB Setup
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true, //https://github.com/Automattic/mongoose/issues/6890
});
mongoose.connection.on("connected", () =>
  console.log("Connected to database.")
);

//App Setup & Middleware
app.use(morgan("combined"));
app.use(cors(corsOptions));
app.use(bodyParser.json({ type: "*/*" }));
router(app);

//Server Setup
const server = http.createServer(app);
server.listen(port);
console.log("Server listening on", port);

//Redis
