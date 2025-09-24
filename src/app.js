import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import {errorhandler} from "./middlewares/error.middlewares.js"
import videoRouter from "./routes/video.routes.js";
import subscriptionRouter from "./routes/subscriptions.routes.js";

const app = express()

app.use(
    cors({
        origin: process.env.CORS_ORGIN,
        credentials: true
    })
)

//common middleware
app.use(express.json({limit:"160kb"}))
app.use(express.urlencoded({extended: true, limit:"16kb"}))
app.use(express.static("public"))
app.use(cookieParser())

//import routes
import healthcheckRouter from "./routes/healthcheck.routes.js"
import userRouter from "./routes/user.routes.js"

//routes
app.use("/api/v1/healthcheck",healthcheckRouter)
app.use("/api/v1/users", userRouter)
app.use("/api/v1/videos", videoRouter);
app.use("/api/v1/subscriptions", subscriptionRouter);


app.use(errorhandler)
export { app }