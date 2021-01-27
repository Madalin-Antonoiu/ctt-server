const express = require("express");
global.fetch = require("node-fetch");
require("dotenv").config();
const Cognito = require("./authentication/cognito");
const { verify } = require("./authentication/cognito");

const app = express();

const port = process.env.port || 3000;
app.listen(port, () => {
  console.log("Listening to 3000.");
});

app.get("/", (req, res) => {
  res.send("Welcome to the homepage");
});

const body = {
  email: "test@gmail.com",
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
