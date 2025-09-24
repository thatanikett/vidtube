import { asyncHandler } from "../utils/asyncHandler.js";
import { APIerror } from "../utils/APIerror.js";
import { APIresponse } from "../utils/APIresponse.js";
import { Comment } from "../models/comment.models.js";
import { Video } from "../models/video.model.js";
import { Like } from "../models/like.models.js";
import mongoose from "mongoose";

// Get video comments with pagination
const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { page = 1, limit = 10, sortBy = "createdAt", sortType = "desc" } = req.query;

  if (!videoId) {
    throw new APIerror(400, "Video ID is required");
  }

  if (!mongoose.isValidObjectId(videoId)) {
    throw new APIerror(400, "Invalid video ID");
  }

  // Check if video exists
  const video = await Video.findById(videoId);
  if (!video) {
    throw new APIerror(404, "Video not found");
  }

  const aggregateQuery = Comment.aggregate([
    {
      $match: {
        video: new mongoose.Types.ObjectId(videoId),
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
            $project: {
              username: 1,
              fullName: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "comment",
        as: "likes",
      },
    },
    {
      $addFields: {
        likesCount: {
          $size: "$likes",
        },
        owner: {
          $first: "$owner",
        },
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
      $sort: {
        [sortBy]: sortType === "desc" ? -1 : 1,
      },
    },
    {
      $project: {
        content: 1,
        createdAt: 1,
        updatedAt: 1,
        owner: 1,
        likesCount: 1,
        isLiked: 1,
      },
    },
  ]);

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
  };

  const comments = await Comment.aggregatePaginate(aggregateQuery, options);

  return res
    .status(200)
    .json(new APIresponse(200, comments, "Video comments fetched successfully"));
});

// Add a comment to video
const addComment = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { content } = req.body;

  if (!videoId) {
    throw new APIerror(400, "Video ID is required");
  }

  if (!mongoose.isValidObjectId(videoId)) {
    throw new APIerror(400, "Invalid video ID");
  }

  if (!content?.trim()) {
    throw new APIerror(400, "Comment content is required");
  }

  // Check if video exists
  const video = await Video.findById(videoId);
  if (!video) {
    throw new APIerror(404, "Video not found");
  }

  const comment = await Comment.create({
    content: content.trim(),
    video: videoId,
    owner: req.user._id,
  });

  const createdComment = await Comment.findById(comment._id).populate(
    "owner",
    "username fullName avatar"
  );

  return res
    .status(201)
    .json(new APIresponse(201, createdComment, "Comment added successfully"));
});

// Update a comment
const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;

  if (!commentId) {
    throw new APIerror(400, "Comment ID is required");
  }

  if (!mongoose.isValidObjectId(commentId)) {
    throw new APIerror(400, "Invalid comment ID");
  }

  if (!content?.trim()) {
    throw new APIerror(400, "Comment content is required");
  }

  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new APIerror(404, "Comment not found");
  }

  // Check if user is the owner of the comment
  if (comment.owner.toString() !== req.user._id.toString()) {
    throw new APIerror(403, "You are not authorized to update this comment");
  }

  const updatedComment = await Comment.findByIdAndUpdate(
    commentId,
    {
      $set: {
        content: content.trim(),
      },
    },
    { new: true }
  ).populate("owner", "username fullName avatar");

  return res
    .status(200)
    .json(new APIresponse(200, updatedComment, "Comment updated successfully"));
});

// Delete a comment
const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  if (!commentId) {
    throw new APIerror(400, "Comment ID is required");
  }

  if (!mongoose.isValidObjectId(commentId)) {
    throw new APIerror(400, "Invalid comment ID");
  }

  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new APIerror(404, "Comment not found");
  }

  // Check if user is the owner of the comment
  if (comment.owner.toString() !== req.user._id.toString()) {
    throw new APIerror(403, "You are not authorized to delete this comment");
  }

  // Delete associated likes
  await Like.deleteMany({ comment: commentId });

  // Delete the comment
  await Comment.findByIdAndDelete(commentId);

  return res
    .status(200)
    .json(new APIresponse(200, {}, "Comment deleted successfully"));
});

// Get user's comments
const getUserComments = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 10, sortBy = "createdAt", sortType = "desc" } = req.query;

  if (!userId) {
    throw new APIerror(400, "User ID is required");
  }

  if (!mongoose.isValidObjectId(userId)) {
    throw new APIerror(400, "Invalid user ID");
  }

  const aggregateQuery = Comment.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "video",
        pipeline: [
          {
            $project: {
              title: 1,
              thumbnail: 1,
              views: 1,
              createdAt: 1,
            },
          },
        ],
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
            $project: {
              username: 1,
              fullName: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "comment",
        as: "likes",
      },
    },
    {
      $addFields: {
        likesCount: {
          $size: "$likes",
        },
        owner: {
          $first: "$owner",
        },
        video: {
          $first: "$video",
        },
      },
    },
    {
      $sort: {
        [sortBy]: sortType === "desc" ? -1 : 1,
      },
    },
    {
      $project: {
        content: 1,
        createdAt: 1,
        updatedAt: 1,
        owner: 1,
        video: 1,
        likesCount: 1,
      },
    },
  ]);

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
  };

  const comments = await Comment.aggregatePaginate(aggregateQuery, options);

  return res
    .status(200)
    .json(new APIresponse(200, comments, "User comments fetched successfully"));
});

// Get comment by ID
const getCommentById = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  if (!commentId) {
    throw new APIerror(400, "Comment ID is required");
  }

  if (!mongoose.isValidObjectId(commentId)) {
    throw new APIerror(400, "Invalid comment ID");
  }

  const comment = await Comment.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(commentId),
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
            $project: {
              username: 1,
              fullName: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "video",
        pipeline: [
          {
            $project: {
              title: 1,
              thumbnail: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "comment",
        as: "likes",
      },
    },
    {
      $addFields: {
        likesCount: {
          $size: "$likes",
        },
        owner: {
          $first: "$owner",
        },
        video: {
          $first: "$video",
        },
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
        content: 1,
        createdAt: 1,
        updatedAt: 1,
        owner: 1,
        video: 1,
        likesCount: 1,
        isLiked: 1,
      },
    },
  ]);

  if (!comment?.length) {
    throw new APIerror(404, "Comment not found");
  }

  return res
    .status(200)
    .json(new APIresponse(200, comment[0], "Comment fetched successfully"));
});

export {
  getVideoComments,
  addComment,
  updateComment,
  deleteComment,
  getUserComments,
  getCommentById,
};
