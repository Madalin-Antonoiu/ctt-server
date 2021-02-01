//This will have to sit on the server
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

export default axios.create({
  baseURL: "https://api.binance.com/api/v3",
  headers: { "X-MBX-APIKEY": `${process.env.MY_READ_ONLY_BINANCE_API_KEY}` },
});
