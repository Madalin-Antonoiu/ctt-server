import express from "express";
import http from "http";
import bodyParser from "body-parser";
import morgan from "morgan";

//App Setup
const app = express();

//Server Setup
const port = process.env.port || 3090;
const server = http.createServer(app);
server.listen(port);
console.log("Server listening on", port);
