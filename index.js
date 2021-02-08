import express from "express";
import http from "http";
import bodyParser from "body-parser";
import morgan from "morgan";
import router from "./router.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import WebSocket from "ws";
import _ from "lodash";
import { Telegraf } from "telegraf";
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

//Telegram Init
const bot = new Telegraf(process.env.BOT_TOKEN)
bot.start((ctx) => ctx.reply('Welcome - /help \n - /start \n - /eth'))
bot.help((ctx) => ctx.reply('- /help \n - /start \n - /eth'))
bot.hears("btc", (ctx) => ctx.reply("You mentioned BTC, nice"))
bot.command("eth", (ctx) => ctx.reply("Wwill fetch the price , eventually..."))

bot.launch();
console.log("Telegraf bot launched.");

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
  var globalData = [];
  // var arr = [];

  const handleMessage = (data) => {
    // Return a new array, formed by only the last 24h USDT coins that changed ( a little unconsisstent for monitoring)
    const newArray = data?.filter((obj) => {
      if (obj.s.includes("USDT")) {

        if (obj.s === "BTCUSDT") {
          console.log(obj.s + ": " + parseInt(obj.c), numberWithCommas(obj.v), {
            $: numberWithCommas(obj.q),
          });
        }

        return obj;
      }



    });

    globalData = newArray;
    //console.log(newArray, { Total: newArray.length });




    const priceAlert = (symbol, price) => {
      return newArray.filter((coin) => {
        if (coin.s === symbol) {

          let zeroPointZeroFivePercent = (0.0005 * price); // If price is 1650$, this is 4.125$;

          if (coin.c === price) {
            return `${symbol} is equal to target ${price}$`
          } else if (coin.c > price && coin.c <= price + zeroPointZeroFivePercent
          ) {
            return `${symbol} is within +${zeroPointZeroFivePercent} of target ${price}`
          } else if (coin.c < price && coin.c >= price - zeroPointZeroFivePercent) {
            return `${symbol} is within -${zeroPointZeroFivePercent} of target ${price}`
          }
        }
      })
    }



    // const btc = priceAlert("BTCUSDT", 39400 );
    // if(btc){
    //   console.log(btc);
    // }
  };


  const numberWithCommas = (x) => {
    return parseInt(x)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Run internalExchangeInfo() and save it to DB every 30 minutes, and cache it into REDIS; // OR save it to REDIS directly?
  // every minute, run the REST API to Binance, get the updated data, compare it with the cache, save the comparison into Redis
  // if anything changed vs last minute check, alert me
  // remove -1 redis key value pair, only keep now and previous.
  //const getExchange = await internalExchangeInfo();
  //console.log(getExchange); // obj props: tradingBTC, tradingUSDT, noTradingBTC,noTradingUSDT, tradingOnlyBTC

  //Create ticker string for binanceSocket
  // let str =
  //   getExchange.tradingUSDT
  //     .map((coin) => coin["symbol"].toLowerCase())
  //     .toString()s
  //     .replace(/,/g, "@ticker/") + "@ticker";

  // console.log(getExchange.tradingUSDT.length);

  //!ticker@arr , ${str} , btcusdt@ticker/ethusdt@ticker/aaveusdt@ticker
  const binanceSocket = new WebSocket(
    `wss://stream.binance.com:9443/ws/!ticker@arr`
  );

  // Every second, on every string message...
  binanceSocket.onmessage = function (event) {
    const data = JSON.parse(event.data);


    handleMessage(data);




    //console.log(event);

    //_.mergeById(arr, data, "s");
  };

  // setInterval(() => {
  //   //console.log(arr);
  //   arr.filter((obj) => {
  //     if (obj.s === "BTCUSDT") {
  //       console.log(obj.s + ": " + parseInt(obj.c), numberWithCommas(obj.v), {
  //         $: numberWithCommas(obj.q),
  //       });
  //     }
  //   });
  // }, 2000);

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

  _.mixin({
    mergeById: function mergeById(arr, obj, idProp) {
      var index = _.findIndex(arr, function (elem) {
        // double check, since undefined === undefined
        return (
          typeof elem[idProp] !== "undefined" && elem[idProp] === obj[idProp]
        );
      });

      if (index > -1) {
        arr[index] = obj;
      } else {
        arr.push(obj);
      }

      return arr;
    },
  });
};

wsRobot();
