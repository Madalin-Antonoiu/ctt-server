import binance from "../services/binance/api/binance.mjs";
import differenceBy from "lodash/differenceBy.js";

export const exchangeInfo = async (req, res, next) => {
  try {
    // This must be put somewhere unaccessible from client, and here just fetch latest data from a local database
    const response = await binance.get(
      `https://api.binance.com/api/v3/exchangeInfo`
    );

    res.json(response.data);
  } catch (e) {
    return res.status(422).send({ error: e });
  }
};

export const tickerAll = async (req, res, next) => {
  try {
    // const binanceSocket = new WebSocket(
    //     `wss://stream.binance.com:9443/ws/!ticker@arr`
    //   );

    // binanceSocket.onmessage = function (event) {
    //   var message = JSON.parse(event.data);
    // };

    // binanceSocket.onopen = () => {
    //   console.log("Candlestick Stream open.");
    // };
    // binanceSocket.onclose = () => {
    //   console.log("Candlestick Stream closed");
    // };

    res.json("hi");
  } catch (e) {
    return res.status(422).send({ error: e });
  }
};

export const internalExchangeInfo = async () => {
  try {
    let constrObj = {
      serverTime: null,
      tradingUSDT: [],
      parkedUSDT: [],
      tradingBTC: [],
      parkedBTC: [],
      tradingOnlyBTC: [],
    };
    // This must be put somewhere unaccessible from client, and here just fetch latest data from a local database
    const response = await binance.get(
      `https://api.binance.com/api/v3/exchangeInfo`
    );

    console.log("Got Exchange info.");

    constrObj["serverTime"] = new Date(
      response.data.serverTime
    ).toLocaleString();

    response.data.symbols?.map((symbol) => {
      if (symbol.quoteAsset === "USDT" && symbol.status === "TRADING") {
        constrObj["tradingUSDT"] = [...constrObj["tradingUSDT"], symbol];
      }
      if (symbol.quoteAsset === "BTC" && symbol.status === "TRADING") {
        constrObj["tradingBTC"] = [...constrObj["tradingBTC"], symbol];
      }

      if (symbol.quoteAsset === "USDT" && symbol.status !== "TRADING") {
        constrObj["parkedUSDT"] = [...constrObj["parkedUSDT"], symbol];
      }
      if (symbol.quoteAsset === "BTC" && symbol.status !== "TRADING") {
        constrObj["parkedBTC"] = [...constrObj["parkedBTC"], symbol];
      }

      return true;
    });

    constrObj["tradingOnlyBTC"] = differenceBy(
      constrObj["tradingBTC"],
      constrObj["tradingUSDT"],
      "baseAsset"
    );

    console.log(constrObj);
    return constrObj;
  } catch (e) {
    return e;
  }
};

export const getUSDTPrices = async () => {
  try {
    const date = new Date().toLocaleString();

    let constrObj = {
      data: [
        {
          serverTime: date,
          USDT_ALL: []
        },
      ]
    };

    const response = await binance.get(
      `https://api.binance.com/api/v3/ticker/price`
    );

    response.data?.map((coin) => {
      if (coin.symbol.endsWith("USDT")) {
        constrObj["data"][0]["USDT_ALL"] = [...constrObj["data"][0]["USDT_ALL"], coin];
      }

      return true;
    });

    return constrObj;
  } catch (e) {
    return e;
  }
}
