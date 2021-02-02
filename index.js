import express from "express";
import http from "http";
import bodyParser from "body-parser";
import morgan from "morgan";
import router from "./router.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import WebSocket from "ws";

// Init
dotenv.config();
const port = process.env.port || 3090;
const app = express();

// Only accept POST requests from this adress.
var corsOptions = {
  origin: process.env.CORS_ALLOWED_ORIGIN,
  optionsSuccessStatus: 200,
  methods: "POST",
};

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

// You also need a WS open with client to communicate changes
// Also need one with telegram bot

//Server to Binance Data Websocket ( all USDT current )
// This list could later be extracted every 10-20 mins from Binance with /exchangeInfo and update with newcomers, if any
// `wss://stream.binance.com:9443/ws/btcusdt@ticker/ethusdt@ticker/bnbusdt@ticker/neousdt@ticker/ltcusdt@ticker/qtumusdt@ticker/adausdt@ticker/xrpusdt@ticker/eosusdt@ticker/tusdusdt@ticker/iotausdt@ticker/xlmusdt@ticker/ontusdt@ticker/trxusdt@ticker/etcusdt@ticker/icxusdt@ticker/nulsusdt@ticker/vetusdt@ticker/paxusdt@ticker/usdcusdt@ticker/linkusdt@ticker/wavesusdt@ticker/bttusdt@ticker/ongusdt@ticker/hotusdt@ticker/zilusdt@ticker/zrxusdt@ticker/fetusdt@ticker/batusdt@ticker/xmrusdt@ticker/zecusdt@ticker/iostusdt@ticker/celrusdt@ticker/dashusdt@ticker/nanousdt@ticker/omgusdt@ticker/thetausdt@ticker/enjusdt@ticker/mithusdt@ticker/maticusdt@ticker/atomusdt@ticker/tfuelusdt@ticker/oneusdt@ticker/ftmusdt@ticker/algousdt@ticker/gtousdt@ticker/dogeusdt@ticker/duskusdt@ticker/ankrusdt@ticker/winusdt@ticker/cosusdt@ticker/npxsusdt@ticker/cocosusdt@ticker/mtlusdt@ticker/tomousdt@ticker/perlusdt@ticker/dentusdt@ticker/mftusdt@ticker/keyusdt@ticker/dockusdt@ticker/wanusdt@ticker/funusdt@ticker/cvcusdt@ticker/chzusdt@ticker/bandusdt@ticker/busdusdt@ticker/beamusdt@ticker/xtzusdt@ticker/renusdt@ticker/rvnusdt@ticker/hbarusdt@ticker/nknusdt@ticker/stxusdt@ticker/kavausdt@ticker/arpausdt@ticker/iotxusdt@ticker/rlcusdt@ticker/ctxcusdt@ticker/bchusdt@ticker/troyusdt@ticker/viteusdt@ticker/fttusdt@ticker/eurusdt@ticker/ognusdt@ticker/drepusdt@ticker/tctusdt@ticker/wrxusdt@ticker/btsusdt@ticker/lskusdt@ticker/bntusdt@ticker/ltousdt@ticker/aionusdt@ticker/mblusdt@ticker/cotiusdt@ticker/stptusdt@ticker/wtcusdt@ticker/datausdt@ticker/solusdt@ticker/ctsiusdt@ticker/hiveusdt@ticker/chrusdt@ticker/btcupusdt@ticker/btcdownusdt@ticker/gxsusdt@ticker/ardrusdt@ticker/mdtusdt@ticker/stmxusdt@ticker/kncusdt@ticker/repusdt@ticker/lrcusdt@ticker/pntusdt@ticker/compusdt@ticker/scusdt@ticker/zenusdt@ticker/snxusdt@ticker/ethupusdt@ticker/ethdownusdt@ticker/adaupusdt@ticker/adadownusdt@ticker/linkupusdt@ticker/linkdownusdt@ticker/vthousdt@ticker/dgbusdt@ticker/gbpusdt@ticker/sxpusdt@ticker/mkrusdt@ticker/dcrusdt@ticker/storjusdt@ticker/bnbupusdt@ticker/bnbdownusdt@ticker/xtzupusdt@ticker/xtzdownusdt@ticker/manausdt@ticker/audusdt@ticker/yfiusdt@ticker/balusdt@ticker/blzusdt@ticker/irisusdt@ticker/kmdusdt@ticker/jstusdt@ticker/srmusdt@ticker/antusdt@ticker/crvusdt@ticker/sandusdt@ticker/oceanusdt@ticker/nmrusdt@ticker/dotusdt@ticker/lunausdt@ticker/rsrusdt@ticker/paxgusdt@ticker/wnxmusdt@ticker/trbusdt@ticker/bzrxusdt@ticker/sushiusdt@ticker/yfiiusdt@ticker/ksmusdt@ticker/egldusdt@ticker/diausdt@ticker/runeusdt@ticker/fiousdt@ticker/umausdt@ticker/eosupusdt@ticker/eosdownusdt@ticker/trxupusdt@ticker/trxdownusdt@ticker/xrpupusdt@ticker/xrpdownusdt@ticker/dotupusdt@ticker/dotdownusdt@ticker/belusdt@ticker/wingusdt@ticker/ltcupusdt@ticker/ltcdownusdt@ticker/uniusdt@ticker/nbsusdt@ticker/oxtusdt@ticker/sunusdt@ticker/avaxusdt@ticker/hntusdt@ticker/flmusdt@ticker/uniupusdt@ticker/unidownusdt@ticker/ornusdt@ticker/utkusdt@ticker/xvsusdt@ticker/alphausdt@ticker/aaveusdt@ticker/nearusdt@ticker/sxpupusdt@ticker/sxpdownusdt@ticker/filusdt@ticker/filupusdt@ticker/fildownusdt@ticker/yfiupusdt@ticker/yfidownusdt@ticker/injusdt@ticker/audiousdt@ticker/ctkusdt@ticker/akrousdt@ticker/axsusdt@ticker/hardusdt@ticker/dntusdt@ticker/straxusdt@ticker/unfiusdt@ticker/roseusdt@ticker/avausdt@ticker/xemusdt@ticker/aaveupusdt@ticker/aavedownusdt@ticker/sklusdt@ticker/susdusdt@ticker/sushiupusdt@ticker/sushidownusdt@ticker/xlmupusdt@ticker/xlmdownusdt@ticker/grtusdt@ticker/juvusdt@ticker/psgusdt@ticker/1inchusdt@ticker/reefusdt@ticker/ogusdt@ticker/atmusdt@ticker/asrusdt@ticker/celousdt@ticker/rifusdt@ticker/btcstusdt@ticker/truusdt@ticker/ckbusdt@ticker/twtusdt@ticker/firousdt@ticker`
//  `wss://stream.binance.com:9443/ws/!ticker@arr`

const handleMessage = (data) => {
  // Return a new array, formed by only the last 24h USDT coins that changed ( a little unconsisstent for monitoring)
  // const newArray = data?.filter((obj) => {
  //   if (obj.s.includes("USDT")) {
  //     return obj;
  //   }
  // });

  globalData = data;
  //console.log(newArray, { Total: newArray.length });
};

var globalData = [];

const binanceSocket = new WebSocket(
  `wss://stream.binance.com:9443/ws/!ticker@arr`
);

// Every second, on every string message...
binanceSocket.onmessage = function (event) {
  const data = JSON.parse(event.data);
  handleMessage(data);

  //console.log(data);

  // Return a new array, formed by only the last 24h USDT coins that changed ( a little unconsisstent for monitoring)
  // const newArray = data.filter((obj) => {
  //   if (obj.s.includes("USDT")) {
  //     return obj;
  //   }
  // });

  // // console.log(newArray);
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
