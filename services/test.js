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

        this.canSave = true;
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
                if (err) this.bot.telegram.sendMessage(this.golemDebugID, `Can't get exchangeInfo from Redis! `);

                let response = JSON.parse(reply); // From Redis DB
                const is = {
                    get newCoins() { return result.tradingUSDT.length !== response.tradingUSDT.length && result.tradingUSDT.length !== 0 },
                    get maintenance() { return result.tradingUSDT.length === 0 }
                }

                if (is.newCoins) {

                    try {
                        const compare = differenceBy(result.tradingUSDT, response.tradingUSDT, "baseAsset");

                        const newCoins = compare.map((each) => {
                            return each.baseAsset
                        }).toString();

                        console.log("NEW COIN(S)", newCoins); // will print a string with the name of the new coins
                        this.bot.telegram.sendMessage(this.golemID, `🚀NEW COIN(s)🚀: ${newCoins} \nTotal now: ${result.tradingUSDT.length} `);

                    } catch (e) {
                        this.bot.telegram.sendMessage(this.golemID, `ERROR Trying to give you the new coin(s). Go see server logs. You have got 20 mins. `);
                    }

                }
                else if (is.maintenance) {
                    this.canSave = false;
                    //Inform that it is maintenance
                    this.bot.telegram.sendMessage(this.golemDebugID, `🔧Binance MAINTENANCE🔧. Now: T${result.tradingUSDT.length} P${result.parkedUSDT.length}, Redis: T${response.tradingUSDT.length} P${response.parkedUSDT.length} \n(vs. ${response.serverTime}), \nCan save: ${this.canSave}. `);

                    // Really important, stop saving to database during maintenance. So when it comes back, if tradingCoins are any different compared to...
                    // before-maintenance redis save, then it will alert me, in the if statement above.
                }
                else {
                    this.bot.telegram.sendMessage(this.golemDebugID, `No difference😞 \nNow: ${result.tradingUSDT.length}|${result.parkedUSDT.length}, Redis: ${response.tradingUSDT.length}|${response.parkedUSDT.length} \n(${response.serverTime}), \nCan save: ${this.canSave}.`);
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

                this.bot.telegram.sendMessage(this.golemDebugID, `🚩Redis SAVED🚩: ${response.serverTime} \nTrading:${response.tradingUSDT.length}, Parked:${response.parkedUSDT.length}. \nCan save: ${this.canSave} `);
                return true
            });



        }

        //!ATTENTION. Do not attempt to save to redis prior to first 2 min coin check, it will ruin the save  during Binance maintenance. !!!!
        this.bot.telegram.sendMessage(this.golemDebugID, `🔄 Restarted 🔄 \nCan save to Redis: ${this.canSave}. \nNew save in 20m. \nCoin check every 2m.`);

        setInterval(async () => {
            this.getInfoAndCompareItToRedis();
        }, 120000) // 2 min

        setInterval(async () => {
            if (this.canSave) {
                this.saveToRedis();
            }
        }, 1200000) // every 20 min


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
