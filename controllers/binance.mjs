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

export const internalExchangeInfo = async () => {
  try {
    let constrObj = {
      serverTime: null,
      tradingUSDT: [],
      noTradingUSDT: [],
      tradingBTC: [],
      noTradingBTC: [],
      tradingOnlyBTC: [],
    };
    // This must be put somewhere unaccessible from client, and here just fetch latest data from a local database
    const response = await binance.get(
      `https://api.binance.com/api/v3/exchangeInfo`
    );

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
        constrObj["noTradingUSDT"] = [...constrObj["noTradingUSDT"], symbol];
      }
      if (symbol.quoteAsset === "BTC" && symbol.status !== "TRADING") {
        constrObj["noTradingBTC"] = [...constrObj["noTradingBTC"], symbol];
      }

      return true;
    });

    constrObj["tradingOnlyBTC"] = differenceBy(
      constrObj["tradingBTC"],
      constrObj["tradingUSDT"],
      "baseAsset"
    );

    return constrObj;
  } catch (e) {
    return e;
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
