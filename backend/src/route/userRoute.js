import { Router } from "express";

import { login, register } from "../controller/usercontroler.js";
const router = Router();
router.route("/login").post(login);
router.route("/register").post(register);

// TODO: Add handlers for these routes when implemented:
// router.route("/home").get(homeHandler);
// router.route("/add_to_activity").post(addToActivity);
// router.route("/get_all_activity").get(getAllActivity);

export default router;

