import express from "express";
import http from "http";
import bodyParser from "body-parser";
import morgan from "morgan";
import router from "./router.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import WebSocket from "ws";
// import redis from "redis";

import { internalExchangeInfo } from "./controllers/binance.mjs";

dotenv.config();
const port = process.env.port || 3000;
const app = express();
const corsOptions = {
  origin: process.env.CORS_ALLOWED_ORIGIN,
  optionsSuccessStatus: 200,
  methods: "POST", // ONLY ACCEPTING POST
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

// Websocket - extract it into separate file
const wsRobot = async () => {
  const getExchange = await internalExchangeInfo();
  // Run internalExchangeInfo() and save it to DB every 30 minutes, and cache it into REDIS; // OR save it to REDIS directly?
  // every minute, run the REST API to Binance, get the updated data, compare it with the cache, save the comparison into Redis
  // if anything changed vs last minute check, alert me
  // remove -1 redis key value pair, only keep now and previous.

  console.log(getExchange); // obj props: tradingBTC, tradingUSDT, noTradingBTC,noTradingUSDT, tradingOnlyBTC

  var globalData = [];
  const handleMessage = (data) => {
    // Return a new array, formed by only the last 24h USDT coins that changed ( a little unconsisstent for monitoring)
    const newArray = data?.filter((obj) => {
      if (obj.s.includes("USDT")) {
        return obj;
      }
    });

    globalData = newArray;
    //console.log(newArray, { Total: newArray.length });
  };

  const binanceSocket = new WebSocket(
    `wss://stream.binance.com:9443/ws/!ticker@arr`
  );

  // Every second, on every string message...
  binanceSocket.onmessage = function (event) {
    const data = JSON.parse(event.data);
    handleMessage(data);

    //console.log(data);
  };

  binanceSocket.onopen = () => {
    console.log("Stream open");

    const wss = new WebSocket.Server({ port: 8080 });

    wss.on("connection", function connection(ws) {
      ws.on("message", function incoming(message) {
        console.log("received: %s", message);
      });

      function intervalFunc() {
        ws.send(JSON.stringify(globalData));
      }
      setInterval(intervalFunc, 1000);
    });
  };

  binanceSocket.onclose = () => {
    console.log("Stream closed");
  };
};

// wsRobot();
