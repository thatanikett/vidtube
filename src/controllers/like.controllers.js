import { asyncHandler } from "../utils/asyncHandler.js";
import { APIerror } from "../utils/APIerror.js";
import { APIresponse } from "../utils/APIresponse.js";
import { Like } from "../models/like.models.js";
import { Video } from "../models/video.model.js";
import { Comment } from "../models/comment.models.js";
import { Tweet } from "../models/tweet.models.js";
import mongoose from "mongoose";

// Toggle like on video
const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

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

  // Check if user has already liked the video
  const existingLike = await Like.findOne({
    video: videoId,
    likedBy: req.user._id,
  });

  if (existingLike) {
    // Unlike the video
    await Like.findByIdAndDelete(existingLike._id);
    return res
      .status(200)
      .json(new APIresponse(200, { isLiked: false }, "Video unliked successfully"));
  } else {
    // Like the video
    const like = await Like.create({
      video: videoId,
      likedBy: req.user._id,
    });

    return res
      .status(201)
      .json(new APIresponse(201, { isLiked: true, like }, "Video liked successfully"));
  }
});

// Toggle like on comment
const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  if (!commentId) {
    throw new APIerror(400, "Comment ID is required");
  }

  if (!mongoose.isValidObjectId(commentId)) {
    throw new APIerror(400, "Invalid comment ID");
  }

  // Check if comment exists
  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new APIerror(404, "Comment not found");
  }

  // Check if user has already liked the comment
  const existingLike = await Like.findOne({
    comment: commentId,
    likedBy: req.user._id,
  });

  if (existingLike) {
    // Unlike the comment
    await Like.findByIdAndDelete(existingLike._id);
    return res
      .status(200)
      .json(new APIresponse(200, { isLiked: false }, "Comment unliked successfully"));
  } else {
    // Like the comment
    const like = await Like.create({
      comment: commentId,
      likedBy: req.user._id,
    });

    return res
      .status(201)
      .json(new APIresponse(201, { isLiked: true, like }, "Comment liked successfully"));
  }
});

// Toggle like on tweet
const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  if (!tweetId) {
    throw new APIerror(400, "Tweet ID is required");
  }

  if (!mongoose.isValidObjectId(tweetId)) {
    throw new APIerror(400, "Invalid tweet ID");
  }

  // Check if tweet exists
  const tweet = await Tweet.findById(tweetId);
  if (!tweet) {
    throw new APIerror(404, "Tweet not found");
  }

  // Check if user has already liked the tweet
  const existingLike = await Like.findOne({
    tweet: tweetId,
    likedBy: req.user._id,
  });

  if (existingLike) {
    // Unlike the tweet
    await Like.findByIdAndDelete(existingLike._id);
    return res
      .status(200)
      .json(new APIresponse(200, { isLiked: false }, "Tweet unliked successfully"));
  } else {
    // Like the tweet
    const like = await Like.create({
      tweet: tweetId,
      likedBy: req.user._id,
    });

    return res
      .status(201)
      .json(new APIresponse(201, { isLiked: true, like }, "Tweet liked successfully"));
  }
});

// Get all liked videos by user
const getLikedVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const aggregateQuery = Like.aggregate([
    {
      $match: {
        likedBy: req.user._id,
        video: { $exists: true },
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
            $match: {
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
            $addFields: {
              owner: { $first: "$owner" },
            },
          },
        ],
      },
    },
    {
      $unwind: "$video",
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $project: {
        _id: 1,
        video: 1,
        createdAt: 1,
      },
    },
  ]);

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
  };

  const likedVideos = await Like.aggregatePaginate(aggregateQuery, options);

  return res
    .status(200)
    .json(new APIresponse(200, likedVideos, "Liked videos retrieved successfully"));
});

// Get all liked comments by user
const getLikedComments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const aggregateQuery = Like.aggregate([
    {
      $match: {
        likedBy: req.user._id,
        comment: { $exists: true },
      },
    },
    {
      $lookup: {
        from: "comments",
        localField: "comment",
        foreignField: "_id",
        as: "comment",
        pipeline: [
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
            $addFields: {
              owner: { $first: "$owner" },
              video: { $first: "$video" },
            },
          },
        ],
      },
    },
    {
      $unwind: "$comment",
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $project: {
        _id: 1,
        comment: 1,
        createdAt: 1,
      },
    },
  ]);

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
  };

  const likedComments = await Like.aggregatePaginate(aggregateQuery, options);

  return res
    .status(200)
    .json(new APIresponse(200, likedComments, "Liked comments retrieved successfully"));
});

// Get all liked tweets by user
const getLikedTweets = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const aggregateQuery = Like.aggregate([
    {
      $match: {
        likedBy: req.user._id,
        tweet: { $exists: true },
      },
    },
    {
      $lookup: {
        from: "tweets",
        localField: "tweet",
        foreignField: "_id",
        as: "tweet",
        pipeline: [
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
            $addFields: {
              owner: { $first: "$owner" },
            },
          },
        ],
      },
    },
    {
      $unwind: "$tweet",
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $project: {
        _id: 1,
        tweet: 1,
        createdAt: 1,
      },
    },
  ]);

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
  };

  const likedTweets = await Like.aggregatePaginate(aggregateQuery, options);

  return res
    .status(200)
    .json(new APIresponse(200, likedTweets, "Liked tweets retrieved successfully"));
});

// Get like status for a specific content
const getLikeStatus = asyncHandler(async (req, res) => {
  const { contentType, contentId } = req.params;

  if (!contentType || !contentId) {
    throw new APIerror(400, "Content type and content ID are required");
  }

  if (!mongoose.isValidObjectId(contentId)) {
    throw new APIerror(400, "Invalid content ID");
  }

  // Validate content type
  const validContentTypes = ["video", "comment", "tweet"];
  if (!validContentTypes.includes(contentType)) {
    throw new APIerror(400, "Invalid content type. Must be video, comment, or tweet");
  }

  // Build query based on content type
  const query = {
    likedBy: req.user._id,
    [contentType]: contentId,
  };

  const like = await Like.findOne(query);

  return res
    .status(200)
    .json(
      new APIresponse(
        200,
        { isLiked: !!like },
        `${contentType} like status retrieved successfully`
      )
    );
});

// Get like count for a specific content
const getLikeCount = asyncHandler(async (req, res) => {
  const { contentType, contentId } = req.params;

  if (!contentType || !contentId) {
    throw new APIerror(400, "Content type and content ID are required");
  }

  if (!mongoose.isValidObjectId(contentId)) {
    throw new APIerror(400, "Invalid content ID");
  }

  // Validate content type
  const validContentTypes = ["video", "comment", "tweet"];
  if (!validContentTypes.includes(contentType)) {
    throw new APIerror(400, "Invalid content type. Must be video, comment, or tweet");
  }

  // Check if content exists
  let content;
  switch (contentType) {
    case "video":
      content = await Video.findById(contentId);
      break;
    case "comment":
      content = await Comment.findById(contentId);
      break;
    case "tweet":
      content = await Tweet.findById(contentId);
      break;
  }

  if (!content) {
    throw new APIerror(404, `${contentType} not found`);
  }

  // Build query based on content type
  const query = {
    [contentType]: contentId,
  };

  const likeCount = await Like.countDocuments(query);

  return res
    .status(200)
    .json(
      new APIresponse(
        200,
        { likeCount },
        `${contentType} like count retrieved successfully`
      )
    );
});

// Get user's like activity summary
const getUserLikeSummary = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const summary = await Like.aggregate([
    {
      $match: {
        likedBy: userId,
      },
    },
    {
      $group: {
        _id: null,
        totalLikes: { $sum: 1 },
        videoLikes: {
          $sum: {
            $cond: [{ $ifNull: ["$video", false] }, 1, 0],
          },
        },
        commentLikes: {
          $sum: {
            $cond: [{ $ifNull: ["$comment", false] }, 1, 0],
          },
        },
        tweetLikes: {
          $sum: {
            $cond: [{ $ifNull: ["$tweet", false] }, 1, 0],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        totalLikes: 1,
        videoLikes: 1,
        commentLikes: 1,
        tweetLikes: 1,
      },
    },
  ]);

  const result = summary.length > 0 ? summary[0] : {
    totalLikes: 0,
    videoLikes: 0,
    commentLikes: 0,
    tweetLikes: 0,
  };

  return res
    .status(200)
    .json(new APIresponse(200, result, "User like summary retrieved successfully"));
});

export {
  toggleVideoLike,
  toggleCommentLike,
  toggleTweetLike,
  getLikedVideos,
  getLikedComments,
  getLikedTweets,
  getLikeStatus,
  getLikeCount,
  getUserLikeSummary,
};
