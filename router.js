import { SignUp, SignIn } from "./controllers/authentication.mjs";
import passportService from "./services/passport.mjs"; // must be included
import passport from "passport";

//creating the Passport middleware
const requireAuth = passport.authenticate("jwt", { session: false }); // when a user is authenticated, don't try to create a cookie session for them
const requireSignIn = passport.authenticate("local", { session: false });

export default (app) => {
  app.get("/", requireAuth, (req, res) => {
    res.send({ hi: "there" });
  });
  app.post("/signin", requireSignIn, SignIn);
  app.post("/signup", SignUp);
};
