import User from "../models/user.mjs";

export const signup = (req, res, next) => {
  // See if a user with a given email exists
  const { email, password } = req.body;

  User.findOne({ email: email }, (err, existingUser) => {
    //Database connection error
    if (err) return next(err); // here i am getting the error, with findOne

    // If the user does exist, return error
    if (existingUser)
      return res.status(422).send({ error: "Email is in use." }); // 422- Unprocessable entity

    // If the user not exist, create and save user record and respond to request
    const user = new User({
      email: email,
      password: password,
    });

    user.save((err) => {
      if (err) return next(err);

      //Respond to request indicating the user was created
      res.json(user);
    });
  });
};
