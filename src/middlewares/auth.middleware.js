import jwt from "jsonwebtoken";
import { User } from "../models/user.models.js";
import { APIerror } from "../utils/APIerror.js";
import { asyncHandler } from "../utils/asyncHandler.js";



//verifies access token from client then injects user info into req object

export const verifyJWT = asyncHandler(async (req, _, next) => {
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
        throw new APIerror(401, "Access token is missing");
    }

    try {
        const decodedToken =  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        const user = await User.findById(decodedToken._id).select("-password -refreshToken")

        if (!user) {
            throw new APIerror(401, "unauthorized")
        }

        req.user = user; //to inject user info to req object
        next(); //transfer control to next middleware/controller
    } catch (error) {
        throw new APIerror(401, error?.message || "unauthorized , invalid access token");
    }
});