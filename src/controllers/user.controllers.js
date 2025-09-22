import { asyncHandler } from "../utils/asyncHandler.js";
import { APIerror } from "../utils/APIerror.js";
import { User } from "../models/user.models.js";
import { CloudinaryDelete, CloudinaryUpload } from "../utils/cloudinary.js";
import { APIresponse } from "../utils/APIresponse.js";
import jwt from "jsonwebtoken";
import { url } from "inspector";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await userId.findById(userId);
    if (!user) {
      throw new APIerror(404, "user not found");
    }
    const accessToken = user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()

    //attaching refreshtoken to user
    user.refreshToken = refreshToken
    await user.save({validateBeforeSave: false})
    return {accessToken, refreshToken}

  } catch (error) {
    throw new APIerror(500, "failed to generate tokens")
  }
}

const registerUser = asyncHandler(async (req, res, next) => {
  const { fullName, email, username, password } = req.body;

  //validation (can use zod, a ts-based-validation library)
  if (
    //some,allows callback
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new APIerror(400, "all fields are required");
  }

  //checking of existed user
  const existedUser = await User.findOne({
    $or: [{ username }, { email }], //find based on any one
  });

  if (existedUser) {
    throw new APIerror(400, "User with email or username already exists");
  }

  console.warn(req.files);
  //handling files (uploads)
  const avatarlocalpath = req.files?.avatar?.[0]?.path; //unlocking its path
  const coverlocalpath = req.files?.coverimage?.[0]?.path;

  if (!avatarlocalpath) {
    throw new APIerror(400, "avatar file is missing");
  }

  let avatar;
  try {
    avatar = await CloudinaryUpload(avatarlocalpath);
    console.log("uploaded avatar ", avatar);
  } catch (error) {
    console.log("error uploading avatar: ", error);
    throw new APIerror(400, "failed to upload avatar");
  }

  let coverimage;
  try {
    coverimage = await CloudinaryUpload(coverlocalpath);
    console.log("uploaded coverimage ", coverimage);
  } catch (error) {
    console.log("error uploading coverimage: ", error);
    throw new APIerror(400, "failed to upload coverimage");
  }

  try {
    const user = await User.create({   //user injected to db
      fullName,
      avatar: avatar.url,
      coverimage: coverimage?.url || "",
      email,
      password,
      username: username.toLowerCase(),
    });

    const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
    );

    if (!createdUser) {
      throw new APIerror(500, "something went wrong while registering a user");
    }

    return res
      .status(201)
      .json(new APIresponse(200, createdUser, "User registered successfully"));

  } catch (error) {
    console.log("error creating user: ", error);
    if (avatar) {
      await CloudinaryDelete(avatar.public_id);
    }
    if (coverimage) {
      await CloudinaryDelete(coverimage.public_id);
    }
    throw new APIerror(500, "failed to create user, images were deleted");
  }

});

const loginUser = asyncHandler(async (req, res) => {
  //get data from body
  const {email, username, password } = req.body;

  //validation
  if (!email?.trim()) {
    throw new APIerror(400, "email is required");
  }

    const user = await User.findOne({
    $or: [{ username }, { email }], //find based on any one
  });

  if (!user) {
    throw new APIerror(404, "user not found");
  }

  //validating password
  const isPasswordCorrect = await user.isPasswordCorrect(password)
  if (!isPasswordCorrect) {
    throw new APIerror(400, "invalid credentials");
  }

  const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

  const LoggedInUser = await User.findById(user._id)
  .select("-password -refreshToken ");

  if (!LoggedInUser) {
    throw new APIerror(500, "something went wrong while logging in");
  }
  
  const options = {
    httpOnly: true,
    sercure: process.env.NODE_ENV == "production"
  }

  return res
  .status(200)
  .cookie("accessToken", accessToken, options)
  .cookie("refreshToken",refreshToken, options)
  .json(new APIresponse(200,
    {user: LoggedInUser, accessToken, refreshToken},
    "User logged in sucessfully"
  ))
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookie.refreshtoken || req.body.refreshToken

  if (!incomingRefreshToken) {
    throw new APIerror(400, "refresh token is required");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    )
    const user = await User.findById(decodedToken?._id)

    if (!user) {
      throw new APIerror(401, "invalid refresh token");
    }

    if (user.refreshToken !== incomingRefreshToken) {
      throw new APIerror(401, "invalid refresh token");
    }

    const options = {
      httpOnly: true,
      sercure: process.env.NODE_ENV === "production"
    }

    //casted new name to refreshtoken
    const {accessToken, refreshToken: newRefreshToken} = await generateAccessAndRefreshToken(user._id); 

    return res
    .status(200)
    .accessToken("accessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(new APIresponse(
      200,
      {accessToken,
      refreshToken: newRefreshToken
      },
      "Access token refreshed successfully"
    ));

  } catch (error) {
    throw new APIerror(401, "invalid refresh token");
  }
});


const LogoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,  //find
    {
      $set: {
        refreshToken: undefined  //update, removing refreshtoken from db
      }
    },
    {new: true} //to return updated user object
  )

  const options = { 
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  }


  return res
  .status(200)
  .clearCookie("accessToken", options)
  .clearCookie("refreshToken", options)
  .json(new APIresponse(200, {}, "user logged out successfully"));

});


const changCurrentUserPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id)

  const isPasswordValid = user.isPasswordCorrect(oldPassword)

  if (!isPasswordValid) {
    throw new APIerror(400, "old password is incorrect");
  }

  user.password = newPassword; //updated password gets hashed through pre hook
  
  await user.save({validateBeforeSave: false});

  return res
  .status(200)
  .json(new APIresponse(200, {}, "password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
  .status(200)
  .json(new APIresponse(200, req.user, "current user fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email} = req.body;

  if (!fullName?.trim() || !email?.trim()) {
    throw new APIerror(400, "fullName and email are required");
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        fullName,
        email
      }
    },
    {new: true} //to return updated user object
  ).select("-password -refreshToken") 

  return res
  .status(200)
  .json(new APIresponse(200, updatedUser, "user details updated successfully"));
});


const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarlocalpath = req.file?.path;

  if (!avatarlocalpath) {
    throw new APIerror(400, "file is required");
  }

  const avatar = await CloudinaryUpload(avatarlocalpath);

  if (!avatar.url) {
    throw new APIerror(500, "something went wrong while uploading avatar");
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        avatar: avatar.url
      }
    },
    {new: true}
  ).select("-password -refreshToken");

  return res
  .status(200)
  .json(new APIresponse(200, user, "user avatar updated successfully"));
});

const updateUserCoverimage = asyncHandler(async (req, res) => {
  const coverimagelocalpath = req.file?.path;

  if (!coverimagelocalpath) {
    throw new APIerror(400, "file is required");
  }

  const coverimage = await CloudinaryUpload(coverimagelocalpath);

  if (!coverimage.url) {
    throw new APIerror(500, "something went wrong while uploading avatar");
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        avatar: coverimage.url
      }
    },
    {new: true}
  ).select("-password -refreshToken");

  return res
  .status(200)
  .json(new APIresponse(200, user, "user cover image updated successfully"));
  
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
});

const getWatchHistory = asyncHandler(async (req, res) => {
});

export { registerUser , 
  loginUser,
  refreshAccessToken,
  LogoutUser,
  changCurrentUserPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverimage
};