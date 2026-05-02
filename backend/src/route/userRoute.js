import { Router } from "express";

import { login, register } from "../controller/usercontroler.js";
const router = Router();

router.route("/login").post(login);
router.route("/register").post(register);
router.route("/home").get((req, res) => {
  res.status(200).json({ message: "Welcome to home", status: "success" });
});


// TODO: Add handlers for these routes when implemented:
// router.route("/add_to_activity").post(addToActivity);
// router.route("/get_all_activity").get(getAllActivity);

export default router;

