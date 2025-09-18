import mongoose from "mongoose"
import {APIerror} from "../utils/APIerror.js"

const errorhandler = (err, req, res, next) => {
    let error = err

    //to check if error(object) is instance of APIerror (constructor class)
    if(!(error instanceof APIerror)) {
        const statusCode = error.statusCode || error instanceof mongoose.Error ? 400 : 500 

        const message = error.message || "something went wrong"

        error = new APIerror(statusCode, message, error?.errors || [], err.stack)
    }

    const response = {
        ...error, //destructuring/spreading the error obj into response
        message: error.message,
        ...(process.env.NODE_ENV === "development" ? {stack: error.stack } : {})
    }

    return res.status(error.statusCode).json(response)
}

export {errorhandler}