const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.port || 3000;

//The local port listening to this server's console
app.listen(port, () => {
  console.log("Listening to 3000.");
});

app.use(cors());

const whitelist = [
  "http://localhost:3001",
  "http://localhost:3000",
  "https://ctt1.netlify.app",
];
const corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback("Not allowed by CORS");
    }
  },
};

app.use("/api", cors(corsOptions), require("./routes/testSendDataRoute"));
app.get("/hey", (req, res) => res.send("ho!"));
app.get("/", (req, res) => res.send("ok"));

app.get("/login", cors(corsOptions), async (req, res) => {
  const response = await Cognito.signIn(req.body.email, req.body.password);
  console.log(response);
});

// Auth stuff
global.fetch = require("node-fetch");
require("dotenv").config();
const Cognito = require("./authentication/cognito");
const { verify } = require("./authentication/cognito");

const body = {
  email: "antonoiumadalin@gmail.com",
  password: "Test123456!",
};

async function Signup() {
  const response = await Cognito.signUp(body.email, body.password);
  console.log(response);
}

async function Verify() {
  const response = await Cognito.verify(body.email, "710479");
  console.log(response);
}

async function SignIn() {
  const response = await Cognito.signIn(body.email, body.password);
  console.log(response);
}

// Signup();
// Verify();
// SignIn();
