//each controller has a route, and vice versa
import { Router } from "express" // becoz not in app.js
import {healthcheck} from "../controllers/healthcheck_controller.js"

const router = Router()


router.route("/").get(healthcheck)

export default router