import { signup } from "./controllers/authentication.mjs";

export default (app) => {
  app.post("/signup", signup);
};
