import WebSocket from "ws";
import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import { internalExchangeInfo, getUSDTPrices } from "../controllers/binance.mjs"
import _ from "lodash";
import redis from "redis";
import cron from "node-cron";





dotenv.config();

class Communication {
    constructor() {
        this.binanceSocket = new WebSocket(
            `wss://stream.binance.com:9443/ws/!ticker@arr`);
        this.bot = new Telegraf(process.env.BOT_TOKEN)
        this.coinsUSDT = [];
        this.allCoinsTracked = "";
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
                    ws.send(JSON.stringify(this.coinsUSDT));
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
                    let monedaNoua = _.differenceBy(result.tradingUSDT, response.tradingUSDT, "baseAsset");
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
            this.helpers.discoverCoins(data); // feed data into this function every time it comes (1000ms)
        };
        this.binanceSocket.onopen = () => {
            console.log("Stream open");

            const wss = new WebSocket.Server({ port: 8080 });

            const callback = (ws) => {
                ws.send(JSON.stringify(this.allCoinsTracked));
            }

            wss.on("connection", function connection(ws) {
                ws.on("message", function incoming(message) {
                    console.log("received: %s", message);
                });

                setInterval(() => callback(ws), 1000)
            });




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

        // setInterval(() => {

        // }, 60000)// 1m

        cron.schedule('0-59 * * * *', () => {
            console.log('running every minute from 0 from 59');
            this.helpers.savePricesToRedisEveryMinute();
        });


        setInterval(() => {
            // In reality, i should read the value first, extract last and leave it there, for 1h data
            // if length is at least 59, then remove stuff, with cron job
            this.redisClient.set("usdtMarketPrices", "");
            this.bot.telegram.sendMessage(this.golemDebugID, "######### Debug, every hour i  clear Redis 'usdtMarketPrices' ###########");
        }, 3600000) //1h


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
            this.coinsUSDT = { time: new Date().toLocaleString(), data: newArray }
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

        // Related
        discoverCoins: (data) => {

            //Data is an array with coins that changed vs 24h ago
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

                this.coinsUSDT = { time: new Date().toLocaleString(), data: newArray };
            } catch (e) {
                console.log(e)
            }

            // Save prices to Redis every minute - 
            // DONE : savePricesToRedisEveryMinute()

            // Compare coinsUSDT every second against it 
            // Read from Redis every second
            this.redisClient.get("usdtMarketPrices", (err, reply) => {
                if (err) {
                    console.log("ERROR reading every second");
                }

                if (reply !== "") {
                    let redisAsObj = JSON.parse(reply);

                    let _0, _1, _3, _5, _10, _15, _30, _60 = "";

                    const _0m = this.helpers.combineForMinutesAgo(redisAsObj, this.coinsUSDT, "0")
                    const _1m = this.helpers.combineForMinutesAgo(redisAsObj, this.coinsUSDT, "1")
                    const _3m = this.helpers.combineForMinutesAgo(redisAsObj, this.coinsUSDT, "3")
                    const _5m = this.helpers.combineForMinutesAgo(redisAsObj, this.coinsUSDT, "5")
                    const _10m = this.helpers.combineForMinutesAgo(redisAsObj, this.coinsUSDT, "10")
                    const _15m = this.helpers.combineForMinutesAgo(redisAsObj, this.coinsUSDT, "15")
                    const _30m = this.helpers.combineForMinutesAgo(redisAsObj, this.coinsUSDT, "30")
                    const _60m = this.helpers.combineForMinutesAgo(redisAsObj, this.coinsUSDT, "60")



                    // trackCoinEveryInterval("PNT");

                    // let pair = "PNT" + "USDT";

                    // _0m ? _0 = this.helpers.trackCoin(pair, _0m).percentageDiff : "";
                    // _1m ? _1 = this.helpers.trackCoin(pair, _1m).percentageDiff : "";
                    // _3m ? _3 = this.helpers.trackCoin(pair, _3m).percentageDiff : "";
                    // _5m ? _5 = this.helpers.trackCoin(pair, _5m).percentageDiff : "";
                    // _10m ? _10 = this.helpers.trackCoin(pair, _10m).percentageDiff : "";
                    // _15m ? _15 = this.helpers.trackCoin(pair, _15m).percentageDiff : "";
                    // _30m ? _30 = this.helpers.trackCoin(pair, _30m).percentageDiff : "";
                    // _60m ? _60 = this.helpers.trackCoin(pair, _60m).percentageDiff : "";
                    // console.log(`${pair} :`, _0, _1, _3, _5, _10, _15, _30, _60);


                    // console.log(this.helpers.trackAllCoins(_0m));
                    const response = this.helpers.trackAllCoins(_0m);
                    // console.log(response);

                    this.allCoinsTracked = response;
                    // console.log(this.allCoinsTracked);
                    //create a combined object containing all differences

                    // if ws open with client, send it



                }

            })

        },
        savePricesToRedisEveryMinute: async () => {
            const response = await getUSDTPrices();

            try {
                this.redisClient.get("usdtMarketPrices", (err, reply) => {
                    if (err) this.bot.telegram.sendMessage(this.golemDebugID, err);

                    if (reply === "") { // first time only, append entire response.data array
                        this.redisClient.set("usdtMarketPrices", JSON.stringify(response.data));
                    }

                    if (reply !== "") {
                        let destring = JSON.parse(reply);
                        let attachNewData = [...destring, response.data[0]];
                        this.redisClient.set("usdtMarketPrices", JSON.stringify(attachNewData)); // every other, append to the response.data array the new object
                    }

                    return true

                });

                // save prices to redis in this format
                // console.log(response);
                // console.log(this.coinsUSDT)
            } catch (e) {
                console.error(e)
                this.bot.telegram.sendMessage(this.golemDebugID, e);
            }
        },
        merge: (arr1, arr2) => {
            let merged = [];

            for (let i = 0; i < arr1.length; i++) {
                merged.push({
                    ...arr1[i],
                    ...(arr2.find((itmInner) => itmInner.s === arr1[i].symbol))
                }
                );
            }

            return merged
        },
        percentageDiff: (a, b) => {

            return (100 * Math.abs((a - b) / ((a + b) / 2))).toFixed(2);

        },

        //Related
        combineForMinutesAgo: (redisObj, coinsUSDT, minute) => {
            let ago = Number(minute) + 1;
            const time = redisObj[redisObj.length - ago];

            if (time === undefined) return

            let arr1 = time.USDT_ALL;
            let arr2 = coinsUSDT.data;
            const merged = this.helpers.merge(arr1, arr2)
            return { wsTime: coinsUSDT.time, time: time.serverTime, data: merged, minute: minute + "m" }; // this is 1s ago to 59 s ago, then renews 

        },
        trackCoin: (name, parentObject) => {
            if (parentObject === undefined) return

            const coin = name;
            const symbol = parentObject.data?.find(obj => obj.symbol === coin);

            let storageTime = parentObject.time.split(", ").slice(1);
            let priceNow = symbol.c;
            let redisPrice = symbol.price;
            let percentageDiff = null;

            if (priceNow >= redisPrice) {
                percentageDiff = "+" + this.helpers.percentageDiff(Number(priceNow), Number(redisPrice)) + "%";
            }
            if (redisPrice > priceNow) {
                percentageDiff = "-" + this.helpers.percentageDiff(Number(redisPrice), Number(priceNow)) + "%";
            }

            //console.log(`ETHUSDT:`, parseFloat(priceNow), " vs ", parseFloat(obj.price), `(${pastMinute.time.replace("09/02/2021,", "")} )`)
            return {
                percentageDiff: `${percentageDiff} (${parentObject.minute} [${storageTime}])`,
                data: `${coin} (${parentObject.minute}): ${priceNow}(${percentageDiff}) vs  ${redisPrice}(${storageTime})`
            }

        },
        trackAllCoins: (parentObject) => { //track all coins 0m, 1m, 3m..
            if (parentObject === undefined) return

            let storageTime = parentObject.time.split(", ").slice(1);

            const symbol = parentObject.data?.map(obj => {
                // For every of the 259 coins...

                let priceNow = obj.c;
                let redisPrice = obj.price;
                let percentageDiff = null;

                if (priceNow >= redisPrice) {
                    percentageDiff = "+" + this.helpers.percentageDiff(Number(priceNow), Number(redisPrice)) + "%";
                }
                if (redisPrice > priceNow) {
                    percentageDiff = "-" + this.helpers.percentageDiff(Number(redisPrice), Number(priceNow)) + "%";
                }

                //console.log(`ETHUSDT:`, parseFloat(priceNow), " vs ", parseFloat(obj.price), `(${pastMinute.time.replace("09/02/2021,", "")} )`)
                return {
                    coin: obj.symbol,
                    comparedTo: parentObject.minute,
                    priceNow: priceNow,
                    percentageDiff: percentageDiff,
                    priceBackThen: redisPrice,
                    timeBackThen: storageTime[0]
                }
            });

            return symbol;
        }
    }
}





export default Communication;
