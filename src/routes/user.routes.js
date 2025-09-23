import { Router } from "express"
import {
    registerUser , 
    loginUser,
    LogoutUser,
    changCurrentUserPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverimage,
    getUserChannelProfile,
    getWatchHistory
} from "../controllers/user.controllers.js"
import {upload} from "../middlewares/multer.middlewares.js" 
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router()

//UNSECURED ROUTES
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

Router.route("/login").post(verifyJWT, LoginUser)

//SECURED ROUTES
router.route("/logout").post(verifyJWT, LogoutUser)
router.route("/change-password").post(verifyJWT, changCurrentUserPassword)
router.route("/current-user").get(verifyJWT, getCurrentUser)
//because we using req.params
router.route("/c/:username").get(verifyJWT, getUserChannelProfile)
router.route("/update-account").patch(verifyJWT, updateAccountDetails)
router.route("/avatar").patch(verifyJWT, upload.single("avatar") , updateUserAvatar)
router.route("/coverimage").patch(verifyJWT, upload.single("coverimage") , updateUserCoverimage)
router.route("/watch-history").get(verifyJWT, getWatchHistory)


export default router