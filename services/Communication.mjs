import WebSocket from "ws";
import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import { internalExchangeInfo } from "../controllers/binance.mjs"
import differenceBy from "lodash/differenceBy.js";
import redis from "redis";


dotenv.config();

class Communication {
    constructor() {
        this.bot = new Telegraf(process.env.BOT_TOKEN)
        this.binanceSocket = new WebSocket(
            `wss://stream.binance.com:9443/ws/!ticker@arr`);
        this.globalData = [];
        this.timeout = 10000;

        //redis
        this.redisOptions = {
            host: process.env.REDIS_HOST,
            port: 6379,
        }
        this.redisClient = redis.createClient(this.redisOptions);

        //Chat IDs
        this.golemID = "-587747842";
        this.golemDebugID = "-590474568";
    }

    telegramBot() {
        this.bot.start((ctx) => ctx.reply('Welcome - /help \n - /start \n - /eth'))
        this.bot.help((ctx) => ctx.reply('- /help \n - /start \n - /eth'))
        // Commands
        this.bot.command("exchangeInfo", async (ctx) => {
            ctx.reply("Obtaining information...");
            const result = await internalExchangeInfo();
            // Run the exchangeInfo API
            ctx.reply(`USDT - Active : ${result.tradingUSDT.length}, Parked: ${result.parkedUSDT.length}\n BTC - Active : ${result.tradingBTC.length}, Parked: ${result.parkedBTC.length}  `);
        });
        this.bot.launch();
        console.log("Telegraf bot launched.");

    }
    websocket() {
        this.binanceSocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.helpers.handleMessage(data);
        };
        this.binanceSocket.onopen = () => {
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
        this.binanceSocket.onclose = () => {
            console.log("Stream closed");
        };


    }
    redis() {
        this.redisClient.on("error", (err) => {
            this.bot.telegram.sendMessage(this.golemDebugID, err);
            console.log("eroare aici", err);
        });
        this.redisClient.on("connect", () => {
            console.log("Redis connected.");
        });

        this.getInfoAndCompareItToRedis = async () => {
            const result = await internalExchangeInfo();

            this.redisClient.get("exchangeInfo", (err, reply) => {
                if (err) {
                    this.bot.telegram.sendMessage(this.golemDebugID, err);
                }

                let response = JSON.parse(reply);

                if (result.tradingUSDT.length !== response.tradingUSDT.length) {
                    this.bot.telegram.sendMessage(this.golemID, `MONEDA NOUA !!!`);
                    let monedaNoua = differenceBy(result.tradingUSDT, response.tradingUSDT, "baseAsset");
                    this.bot.telegram.sendMessage(this.golemID, `MONEDA NOUA : ${monedaNoua} !!! `);

                } else {
                    this.bot.telegram.sendMessage(this.golemDebugID, `No difference. \nNow: ${result.tradingUSDT.length}, Redis: ${response.tradingUSDT.length}(${response.serverTime})`);
                }
            });


        }

        this.saveToRedis = async () => {
            const result = await internalExchangeInfo();
            this.redisClient.set("exchangeInfo", JSON.stringify(result));

            this.redisClient.get("exchangeInfo", (err, reply) => {
                if (err) {
                    this.bot.telegram.sendMessage(this.golemDebugID, err);
                }
                let response = JSON.parse(reply);

                this.bot.telegram.sendMessage(this.golemDebugID, `Redis Saved: ${response.serverTime} - ${response.tradingUSDT.length}`);
                return true
            });



        }

        this.saveToRedis().then(() => {
            this.getInfoAndCompareItToRedis();
        })

        setInterval(async () => {
            this.getInfoAndCompareItToRedis();
        }, 120000) // 2 min

        setInterval(async () => {
            this.saveToRedis();
        }, 1200000) // 5 min


    }
    start() {
        this.redis();
        this.telegramBot();
        this.websocket();
    }

    helpers = {
        numberWithCommas: (x) => {
            return parseInt(x)
                .toString()
                .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        },
        handleMessage: (data) => {
            const newArray = data?.filter((obj) => {

                if (obj.s.includes("USDT")) {

                    // Debug
                    // if (obj.s === "BTCUSDT") {
                    //     console.log(obj.s + ": " + parseFloat(obj.c).toFixed(2), this.helpers.numberWithCommas(obj.v), {
                    //         $: this.helpers.numberWithCommas(obj.q),
                    //     });
                    // }

                    // THIS IS HOW YOU SET UP AN ALERT
                    //this.helpers.priceAlert(obj, "BTCUSDT", 43650);



                    return obj;
                }


            });
            this.globalData = newArray;
        },
        priceAlert: (obj, symbol, targetPrice) => {
            let incomingSymbol = obj.s;

            if (incomingSymbol === symbol) {
                let zeroPointZeroFivePercent = (0.0005 * targetPrice); // If price is 1650$, this is 4.125$;
                let closedPrice = obj.c;

                if (closedPrice === targetPrice) {
                    let reply = `${symbol} is ${targetPrice}.`
                    console.log(reply);

                    this.bot.telegram.sendMessage(this.golemID, reply)
                } else if (closedPrice > targetPrice && closedPrice <= targetPrice + zeroPointZeroFivePercent
                ) {
                    let reply = `${symbol} is ${parseFloat(closedPrice - targetPrice).toFixed(2)
                        } more than target price of ${targetPrice}.`
                    this.bot.telegram.sendMessage(this.golemID, reply)
                    console.log(reply);
                } else if (closedPrice < targetPrice && closedPrice >= targetPrice - zeroPointZeroFivePercent) {
                    let reply = `${symbol} is ${parseFloat(targetPrice - closedPrice).toFixed(2)
                        } less than target price of ${targetPrice}.`
                    console.log(reply);
                    this.bot.telegram.sendMessage(this.golemID, reply)
                }
            }
        }
    }
}





export default Communication;
