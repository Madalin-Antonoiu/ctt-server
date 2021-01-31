import { signup } from "./controllers/authentication.mjs";
import passportService from "./services/passport.mjs"; // must be included
import passport from "passport";

//creating the Passport middleware
const requireAuth = passport.authenticate("jwt", { session: false }); // when a user is authenticated, don't try to create a cookie session for them

export default (app) => {
  app.get("/", requireAuth, (req, res) => {
    // Send them to requireAuth first, if they get through, then send them to this
    res.send({ hi: "there" });
  });
  app.post("/signup", signup);
};
