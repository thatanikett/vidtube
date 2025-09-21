import { Router } from "express"
import {registerUser, LogoutUser} from "../controllers/user.controllers.js"
import {upload} from "../middlewares/multer.middlewares.js" 
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router()

// post-> receiving the data 
router.route("/register").post(
    upload.fields([
        {
            name:"avatar",
            maxCount:1
        },{
            name:"coverimage",
            maxCount:1
        }
    ]),
    registerUser) //format -> router.route("path").httpmethod( middleware, controller, another controller...)

//secured route
router.route("/logout").post(verifyJWT, LogoutUser)


export default router