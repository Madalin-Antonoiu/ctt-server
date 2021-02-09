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
            this.redisClient.set("usdtMarketPrices", "");
            this.bot.telegram.sendMessage(this.golemDebugID, "Debug, every hour i  clear Redis 'usdtMarketPrices' ");
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
                    //console.log("Redis READ:", redisAsObj, reply.length); //, "Wsocket:", this.coinsUSDT - IMPORTANT DEBUG

                    // At this point i have this.coinsUSDT array of objects containing data every sec about coins that changed last 24h
                    // And redisAsObj which has an array of objects every minute saving price data

                    //compareToAMinuteAgo() - i get last element's price of redisAsObj array (supposed to be past minute), let`s say SFPUSDT
                    // i also get SFPUSDT from this.coinsUSDT( if it exists, this is very unconsistent API)
                    // console log both, every second
                    //console.log(redisAsObj);


                    // I should probably create a new array
                    // containing the ever changing new second data, and the minute past
                    // then it would be easy to compare them and inform


                    let pastMinute = redisAsObj[redisAsObj.length - 1];
                    const result = _.merge(pastMinute.USDT_ALL, this.coinsUSDT.data)
                    let lastMinuteArray = [{ wsTime: this.coinsUSDT.time }, { pastMinute: pastMinute.serverTime }, { combined: result }]; // this is 1s ago to 59 s ago, then renews 



                    const lm = lastMinuteArray[2].combined?.find(obj => obj.symbol === "ETHUSDT");

                    const log = (obj) => {

                        let priceNow = parseFloat(obj.c);
                        let pastMinutePrice = parseFloat(obj.price);
                        let difference = "";

                        if (priceNow >= pastMinutePrice) {
                            difference = `+${parseFloat(priceNow - pastMinutePrice).toFixed(2)}`;

                        }
                        if (pastMinutePrice > priceNow) {
                            difference = `-${parseFloat(pastMinutePrice - priceNow).toFixed(2)}`;
                        }

                        //console.log(`ETHUSDT:`, parseFloat(priceNow), " vs ", parseFloat(obj.price), `(${pastMinute.serverTime.replace("09/02/2021,", "")} )`)
                        return {
                            data: `ETHUSDT (1m): ${priceNow}(${difference}$) vs  ${pastMinutePrice}(${pastMinute.serverTime.replace("09/02/2021,", "")})`
                        }

                    }

                    if (lm) {
                        console.log(log(lm).data);
                    }


                    //console.log(threeMinutesAgo); undefined until 3m of data are present
                    // let threeMinutesAgo = redisAsObj[redisAsObj.length - 4];
                    // if (threeMinutesAgo) {
                    //     const result2 = _.merge(threeMinutesAgo?.USDT_ALL, this.coinsUSDT.data)
                    //     let threeMinutesAgoArray = [{ wsTime: this.coinsUSDT.time }, { threeMinutesAgo: threeMinutesAgo.serverTime }, { combined: result2 }]; // this is 1s ago to 59 s ago, then renews 

                    //     threeMinutesAgoArray[2].combined?.filter((obj) => {
                    //         if (obj.symbol === "ETHUSDT") {
                    //             let priceNow = parseFloat(obj.c);
                    //             let threeMinutesAgoPrice = parseFloat(obj.price);
                    //             let difference = "";

                    //             if (priceNow >= threeMinutesAgoPrice) {
                    //                 difference = `+${parseFloat(priceNow - threeMinutesAgoPrice).toFixed(2)}`;

                    //             }
                    //             if (threeMinutesAgoPrice > priceNow) {
                    //                 difference = `-${parseFloat(threeMinutesAgoPrice - priceNow).toFixed(2)}`;
                    //             }

                    //             //console.log(`ETHUSDT:`, parseFloat(priceNow), " vs ", parseFloat(obj.price), `(${pastMinute.serverTime.replace("09/02/2021,", "")} )`)
                    //             console.log(`ETHUSDT (3m):`, priceNow, `(${difference}$)`, " vs ", threeMinutesAgoPrice, `(${threeMinutesAgo.serverTime.replace("09/02/2021,", "")} )`)


                    //         }
                    //     })

                    // }


                }

            })

            // Compare price now with prices there
            // Say something about it 

            //console.log(this.coinsUSDT); // Around 80.500 length containing all USDT coins data, updated every second
        },
        savePricesToRedisEveryMinute: async () => {
            const response = await getUSDTPrices();
            console.log(response);

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

                    //let addNewDataToTheOld = JSON.stringify(response) + reply; // apend to data array, then stringify everything

                    // this.bot.telegram.sendMessage(this.golemDebugID, `Market Prices: ${response.data.USDT_ALL?.length} at ${response.data.serverTime}`);
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

    }
}





export default Communication;
