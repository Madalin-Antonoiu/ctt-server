import express from "express";
import http from "http";
import bodyParser from "body-parser";
import morgan from "morgan";
import router from "./router.js";

// Setup
const port = process.env.port || 3090;
const app = express();

//App Setup
//Express Middleware
app.use(morgan("combined"));
app.use(bodyParser.json({ type: "*/*" }));
router(app);

//Server Setup
const server = http.createServer(app);
server.listen(port);
console.log("Server listening on", port);
