import { asyncHandler } from "../utils/asyncHandler.js";
import { APIerror } from "../utils/APIerror.js";
import { User } from "../models/user.models.js";
import { CloudinaryDelete, CloudinaryUpload } from "../utils/cloudinary.js";
import { APIresponse } from "../utils/APIresponse.js";
// import {upload} from "../middlewares/multer.middlewares.js"

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
    const user = await User.create({
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

export { registerUser };