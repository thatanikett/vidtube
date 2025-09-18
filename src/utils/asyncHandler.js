//high order function-> returning another function
//replacement of try-catch error handling while doing a async operation

const asyncHandler = (reqHandler) => {
    return (req,res,next) => {
        Promise.resolve(reqHandler(req,res,next)).catch((err) => next(err))
    }
}

export {asyncHandler}