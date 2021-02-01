import binance from "../services/binance/api/binance.mjs";

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
