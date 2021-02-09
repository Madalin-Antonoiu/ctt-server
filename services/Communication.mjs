import WebSocket from "ws";
import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import { internalExchangeInfo, getUSDTPrices } from "../controllers/binance.mjs"
import differenceBy from "lodash/differenceBy.js";
import redis from "redis";


dotenv.config();

class Communication {
    constructor() {
        this.binanceSocket = new WebSocket(
            `wss://stream.binance.com:9443/ws/!ticker@arr`);
        this.bot = new Telegraf(process.env.BOT_TOKEN)
        this.coinsUSDT = [];
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
                    ws.send(JSON.stringify(coinsUSDT));
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
                    let monedaNoua = differenceBy(result.tradingUSDT, response.tradingUSDT, "baseAsset");
                    this.bot.telegram.sendMessage(this.golemID, `MONEDA NOUA : ${monedaNoua} !!! `);
                } else {
                    this.bot.telegram.sendMessage(this.golemDebugID, `No difference. \n Now: ,${result.tradingUSDT.length}, Redis: ${response.tradingUSDT.length}`);
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
    discoverProfitableCoins() {
        //1. Launch Telegram Bot
        this.bot.command("coins", async (ctx) => {
            ctx.reply("Obtaining information...");
            const result = await internalExchangeInfo();
            // Run the exchangeInfo API
            ctx.reply(`USDT - Active : ${result.tradingUSDT.length}, Parked: ${result.parkedUSDT.length}\n BTC - Active : ${result.tradingBTC.length}, Parked: ${result.parkedBTC.length}  `);
        });
        this.bot.launch();

        //2.Websocket is launched in Constructor. Listen to it
        this.binanceSocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.helpers.discoverCoins(data);
        };
        this.binanceSocket.onopen = () => {
            console.log("Stream open");
        };
        this.binanceSocket.onclose = () => {
            console.log("Stream closed");
        };

        //3. Compare Data & Alert
        // Open Redis
        this.redisClient.on("error", (err) => {
            this.bot.telegram.sendMessage(this.golemDebugID, err);
            console.log("eroare aici", err);
        });
        this.redisClient.on("connect", () => {
            console.log("Redis connected.");
        });

        console.log("Will save prices to Redis in 60s.")

        setInterval(() => {
            this.helpers.savePricesToRedisEveryMinute();
            console.log("Saved to Redis.")
        }, 60000)
        // Data comes every second from websocket.  Save it to Redis every x seconds for comparison later
        // Keep Comparing it to Redis
        // Alert for each coin if profitable

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
                    if (obj.s === "BTTUSDT") {
                        console.log(obj.s + ": " + parseFloat(obj.c), this.helpers.numberWithCommas(obj.v), {
                            $: this.helpers.numberWithCommas(obj.q),
                        });
                    }

                    // THIS IS HOW YOU SET UP AN ALERT
                    //this.helpers.priceAlert(obj, "BTCUSDT", 43650);



                    return obj;
                }


            });
            this.coinsUSDT = newArray;
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
        },
        discoverCoins: (data) => {

            //Data is an array with coins that changed vs 24h ago. Save prices to redis every 1 min
            try {
                const newArray = data?.filter((obj) => {


                    if (obj.s.includes("USDT")) {



                        // Debug
                        // if (obj.s === "BTTUSDT") {
                        //     console.log(obj.s + ": " + parseFloat(obj.c), this.helpers.numberWithCommas(obj.v), {
                        //         $: this.helpers.numberWithCommas(obj.q),
                        //     });
                        // }

                        // THIS IS HOW YOU SET UP AN ALERT
                        //this.helpers.priceAlert(obj, "BTCUSDT", 43650);



                        return obj;
                    }


                });
                this.coinsUSDT = newArray;
            } catch (e) {
                console.log(e)
            }
            // Save to Redis every 60 seconds/ 1 minute - 
            // Compare coinsUSDT every second against it 


            //console.log(this.coinsUSDT); // Around 80.500 length containing all USDT coins data, updated every second
        },
        savePricesToRedisEveryMinute: async () => {
            const response = await getUSDTPrices();

            if (response) {
                console.log(response);
                console.log(this.coinsUSDT)
            } else {
                console.error("Error")
            }
        }
    }
}





export default Communication;
