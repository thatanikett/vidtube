import dotenv from "dotenv"

dotenv.config({
    path:"./.env"
})

import connectDB from "./db/index.js"
import {app} from "./app.js"

const PORT = process.env.PORT || 7000;

connectDB()
.then(() => {
    app.listen(PORT, () => {
        console.log(`server is running on port ${PORT}`)
    })
})
.catch((err) => {
    console.log("MongoDB connection error: ", err)
})
