import express from "express";
import http from "http";
import bodyParser from "body-parser";
import morgan from "morgan";
import router from "./router.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import Communication from "./services/Communication.mjs"
import redis from "redis";



dotenv.config();
const port = process.env.port || 3000;
const app = express();
const corsOptions = {
  origin: process.env.CORS_ALLOWED_ORIGIN,
  optionsSuccessStatus: 200,
  methods: "POST", // ONLY ACCEPTING POST
};
const redisOptions = {
  host: process.env.REDIS_HOST,
  port: 6379,
}


//Redis
const client = redis.createClient(redisOptions);
client.on("error", function (error) {
  console.error(error);
});
client.on("connect", (ev) => {
  console.log("Redis connected.");
  client.set("foo", "TO THE MOON");

  client.get("foo", (err, reply) => {
    // reply is null when the key is missing
    console.log(reply);
  });


});







// DB Setup
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
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


const communi = new Communication();
communi.start();

