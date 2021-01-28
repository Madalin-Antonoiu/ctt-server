import UserModel from "../models/user.mjs";

export const signup = (req, res, next) => {
  // See if a user with a given email exists
  const { email, password } = req.body;

  UserModel.findOne({ email: email }, (err, existingUser) => {});

  // If it does exist, return error
  // If it does not exist, create and save user record and respond to request
};
