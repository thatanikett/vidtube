import { asyncHandler } from "../utils/asyncHandler.js";
import { APIerror } from "../utils/APIerror.js";
import { APIresponse } from "../utils/APIresponse.js";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.models.js";
import { Like } from "../models/like.models.js";
import { Comment } from "../models/comment.models.js";
import { CloudinaryUpload, CloudinaryDelete } from "../utils/cloudinary.js";
import mongoose from "mongoose";

// Get all videos with pagination and filters
const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;

  const pipeline = [];

  // Match published videos
  pipeline.push({
    $match: {
      isPublished: true,
    },
  });

  // Filter by owner if userId provided
  if (userId) {
    if (!mongoose.isValidObjectId(userId)) {
      throw new APIerror(400, "Invalid user ID");
    }
    pipeline.push({
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    });
  }

  // Search by title or description
  if (query) {
    pipeline.push({
      $match: {
        $or: [
          { title: { $regex: query, $options: "i" } },
          { description: { $regex: query, $options: "i" } },
        ],
      },
    });
  }

  // Lookup owner details
  pipeline.push({
    $lookup: {
      from: "users",
      localField: "owner",
      foreignField: "_id",
      as: "owner",
      pipeline: [
        {
          $project: {
            username: 1,
            fullName: 1,
            avatar: 1,
          },
        },
      ],
    },
  });

  pipeline.push({
    $unwind: "$owner",
  });

  // Sort
  if (sortBy && sortType) {
    pipeline.push({
      $sort: {
        [sortBy]: sortType === "desc" ? -1 : 1,
      },
    });
  } else {
    pipeline.push({
      $sort: { createdAt: -1 },
    });
  }

  const aggregate = Video.aggregate(pipeline);
  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
  };

  const videos = await Video.aggregatePaginate(aggregate, options);

  return res
    .status(200)
    .json(new APIresponse(200, videos, "Videos fetched successfully"));
});

// Publish/upload a video
const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  if (!title?.trim() || !description?.trim()) {
    throw new APIerror(400, "Title and description are required");
  }

  const videoFileLocalPath = req.files?.videoFile?.[0]?.path;
  const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

  if (!videoFileLocalPath) {
    throw new APIerror(400, "Video file is required");
  }

  if (!thumbnailLocalPath) {
    throw new APIerror(400, "Thumbnail is required");
  }

  let videoFile, thumbnail;

  try {
    // Upload video file to cloudinary
    videoFile = await CloudinaryUpload(videoFileLocalPath);
    if (!videoFile) {
      throw new APIerror(500, "Failed to upload video file");
    }

    // Upload thumbnail to cloudinary
    thumbnail = await CloudinaryUpload(thumbnailLocalPath);
    if (!thumbnail) {
      throw new APIerror(500, "Failed to upload thumbnail");
    }

    // Create video document
    const video = await Video.create({
      videoFile: videoFile.url,
      thumbnail: thumbnail.url,
      title: title.trim(),
      description: description.trim(),
      duration: videoFile.duration || 0,
      owner: req.user._id,
    });

    const uploadedVideo = await Video.findById(video._id).populate(
      "owner",
      "username fullName avatar"
    );

    return res
      .status(201)
      .json(new APIresponse(201, uploadedVideo, "Video uploaded successfully"));
  } catch (error) {
    // Cleanup uploaded files on error
    if (videoFile) {
      await CloudinaryDelete(videoFile.public_id);
    }
    if (thumbnail) {
      await CloudinaryDelete(thumbnail.public_id);
    }
    throw error;
  }
});

// Get video by id
const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    throw new APIerror(400, "Video ID is required");
  }

  if (!mongoose.isValidObjectId(videoId)) {
    throw new APIerror(400, "Invalid video ID");
  }

  const video = await Video.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(videoId),
        isPublished: true,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "subscribers",
            },
          },
          {
            $addFields: {
              subscribersCount: { $size: "$subscribers" },
              isSubscribed: {
                $cond: {
                  if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                  then: true,
                  else: false,
                },
              },
            },
          },
          {
            $project: {
              username: 1,
              fullName: 1,
              avatar: 1,
              subscribersCount: 1,
              isSubscribed: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },
    {
      $addFields: {
        likesCount: { $size: "$likes" },
        owner: { $first: "$owner" },
        isLiked: {
          $cond: {
            if: { $in: [req.user?._id, "$likes.likedBy"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        likes: 0,
      },
    },
  ]);

  if (!video?.length) {
    throw new APIerror(404, "Video not found");
  }

  // Increment view count
  await Video.findByIdAndUpdate(videoId, {
    $inc: { views: 1 },
  });

  // Add to watch history if user is logged in
  if (req.user) {
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { watchHistory: videoId },
    });
  }

  return res
    .status(200)
    .json(new APIresponse(200, video[0], "Video fetched successfully"));
});

// Update video details
const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;

  if (!videoId) {
    throw new APIerror(400, "Video ID is required");
  }

  if (!mongoose.isValidObjectId(videoId)) {
    throw new APIerror(400, "Invalid video ID");
  }

  if (!title?.trim() && !description?.trim()) {
    throw new APIerror(400, "At least one field (title or description) is required");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new APIerror(404, "Video not found");
  }

  // Check if user is the owner
  if (video.owner.toString() !== req.user._id.toString()) {
    throw new APIerror(403, "You are not authorized to update this video");
  }

  const updateFields = {};
  if (title?.trim()) updateFields.title = title.trim();
  if (description?.trim()) updateFields.description = description.trim();

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    { $set: updateFields },
    { new: true }
  ).populate("owner", "username fullName avatar");

  return res
    .status(200)
    .json(new APIresponse(200, updatedVideo, "Video updated successfully"));
});

// Delete video
const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    throw new APIerror(400, "Video ID is required");
  }

  if (!mongoose.isValidObjectId(videoId)) {
    throw new APIerror(400, "Invalid video ID");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new APIerror(404, "Video not found");
  }

  // Check if user is the owner
  if (video.owner.toString() !== req.user._id.toString()) {
    throw new APIerror(403, "You are not authorized to delete this video");
  }

  try {
    // Delete video and thumbnail from cloudinary
    const videoUrl = video.videoFile;
    const thumbnailUrl = video.thumbnail;

    // Extract public IDs from URLs
    const videoPublicId = videoUrl.split("/").pop().split(".")[0];
    const thumbnailPublicId = thumbnailUrl.split("/").pop().split(".")[0];

    await CloudinaryDelete(videoPublicId);
    await CloudinaryDelete(thumbnailPublicId);

    // Delete associated likes and comments
    await Like.deleteMany({ video: videoId });
    await Comment.deleteMany({ video: videoId });

    // Remove from playlists and watch history
    await User.updateMany(
      {},
      { $pull: { watchHistory: videoId } }
    );

    // Delete video document
    await Video.findByIdAndDelete(videoId);

    return res
      .status(200)
      .json(new APIresponse(200, {}, "Video deleted successfully"));
  } catch (error) {
    throw new APIerror(500, "Failed to delete video");
  }
});

// Toggle publish status
const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    throw new APIerror(400, "Video ID is required");
  }

  if (!mongoose.isValidObjectId(videoId)) {
    throw new APIerror(400, "Invalid video ID");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new APIerror(404, "Video not found");
  }

  // Check if user is the owner
  if (video.owner.toString() !== req.user._id.toString()) {
    throw new APIerror(403, "You are not authorized to modify this video");
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    { $set: { isPublished: !video.isPublished } },
    { new: true }
  ).populate("owner", "username fullName avatar");

  return res
    .status(200)
    .json(
      new APIresponse(
        200,
        updatedVideo,
        `Video ${updatedVideo.isPublished ? "published" : "unpublished"} successfully`
      )
    );
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
