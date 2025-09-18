//standardising API errors
//Error is already a built in class , so we extends upon it

class APIerror extends Error {
    constructor(
        statusCode,
        message = "something went wrong",
        errors = [],
        stack = "", //stacktray of where th errors are
    ){
        super(message) //Error class handles message
        this.statusCode = statusCode
        this.data = null
        this.message = message
        this.success = false
        this.errors = errors;

        if (stack) {
            this.stack = stack
        } else {
            Error.captureStackTrace(this, this.constructor)
        }
    }
}


export { APIerror }