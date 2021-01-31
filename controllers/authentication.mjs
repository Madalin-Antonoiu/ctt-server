import User from "../models/user.mjs";
// import { body, validationResult } from "express-validator"; - for later // https://www.youtube.com/watch?v=YMw9_rw9kcE&list=PLPMbb3KXRmigGdxkvrGfR4RmsU4J78_BQ&index=3
import jwt from "jwt-simple"; // https://jwt.io/
import dotenv from "dotenv";

// Init
dotenv.config();

const tokenForUser = (user) => {
  const timestamp = new Date().getTime();
  return jwt.encode({ sub: user.id, iat: timestamp }, process.env.JWT_SECRET);
};

export const SignUp = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(422)
      .send({ error: "You must provide email and password." });
  }

  User.findOne({ email: email }, (err, existingUser) => {
    if (err) return next(err);
    if (existingUser) {
      return res.status(422).send({ error: "Email is in use." });
    }

    const user = new User({
      email: email,
      password: password,
    });

    user.save((err) => {
      if (err) return next(err);
      res.json({ token: tokenForUser(user) });
    });
  });
};

export const SignIn = (req, res, next) => {
  // User has already had their email and password authed, we just need to give them a JWT token
  res.send({ token: tokenForUser(req.user) });
};
