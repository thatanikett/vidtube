import { asyncHandler } from "../utils/asyncHandler.js";
import { APIerror } from "../utils/APIerror.js";
import { APIresponse } from "../utils/APIresponse.js";
import { Tweet } from "../models/tweet.models.js";
import { User } from "../models/user.models.js";
import { Like } from "../models/like.models.js";
import mongoose from "mongoose";

// Create tweet
const createTweet = asyncHandler(async (req, res) => {
  const { content } = req.body;

  if (!content?.trim()) {
    throw new APIerror(400, "Tweet content is required");
  }

  // Check content length (similar to Twitter's character limit)
  if (content.trim().length > 280) {
    throw new APIerror(400, "Tweet content cannot exceed 280 characters");
  }

  const tweet = await Tweet.create({
    content: content.trim(),
    owner: req.user._id,
  });

  const createdTweet = await Tweet.findById(tweet._id).populate(
    "owner",
    "username fullName avatar"
  );

  return res
    .status(201)
    .json(new APIresponse(201, createdTweet, "Tweet created successfully"));
});

// Get user tweets
const getUserTweets = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 10, sortBy = "createdAt", sortType = "desc" } = req.query;

  if (!userId) {
    throw new APIerror(400, "User ID is required");
  }

  if (!mongoose.isValidObjectId(userId)) {
    throw new APIerror(400, "Invalid user ID");
  }

  // Check if user exists
  const user = await User.findById(userId);
  if (!user) {
    throw new APIerror(404, "User not found");
  }

  const aggregateQuery = Tweet.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
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
        foreignField: "tweet",
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

  const tweets = await Tweet.aggregatePaginate(aggregateQuery, options);

  return res
    .status(200)
    .json(new APIresponse(200, tweets, "User tweets fetched successfully"));
});

// Update tweet
const updateTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  const { content } = req.body;

  if (!tweetId) {
    throw new APIerror(400, "Tweet ID is required");
  }

  if (!mongoose.isValidObjectId(tweetId)) {
    throw new APIerror(400, "Invalid tweet ID");
  }

  if (!content?.trim()) {
    throw new APIerror(400, "Tweet content is required");
  }

  // Check content length
  if (content.trim().length > 280) {
    throw new APIerror(400, "Tweet content cannot exceed 280 characters");
  }

  const tweet = await Tweet.findById(tweetId);

  if (!tweet) {
    throw new APIerror(404, "Tweet not found");
  }

  // Check if user is the owner of the tweet
  if (tweet.owner.toString() !== req.user._id.toString()) {
    throw new APIerror(403, "You are not authorized to update this tweet");
  }

  const updatedTweet = await Tweet.findByIdAndUpdate(
    tweetId,
    {
      $set: {
        content: content.trim(),
      },
    },
    { new: true }
  ).populate("owner", "username fullName avatar");

  return res
    .status(200)
    .json(new APIresponse(200, updatedTweet, "Tweet updated successfully"));
});

// Delete tweet
const deleteTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  if (!tweetId) {
    throw new APIerror(400, "Tweet ID is required");
  }

  if (!mongoose.isValidObjectId(tweetId)) {
    throw new APIerror(400, "Invalid tweet ID");
  }

  const tweet = await Tweet.findById(tweetId);

  if (!tweet) {
    throw new APIerror(404, "Tweet not found");
  }

  // Check if user is the owner of the tweet
  if (tweet.owner.toString() !== req.user._id.toString()) {
    throw new APIerror(403, "You are not authorized to delete this tweet");
  }

  // Delete associated likes
  await Like.deleteMany({ tweet: tweetId });

  // Delete the tweet
  await Tweet.findByIdAndDelete(tweetId);

  return res
    .status(200)
    .json(new APIresponse(200, {}, "Tweet deleted successfully"));
});

// Get all tweets (timeline/feed)
const getAllTweets = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy = "createdAt", sortType = "desc" } = req.query;

  const pipeline = [];

  // Search by content
  if (query) {
    pipeline.push({
      $match: {
        content: { $regex: query, $options: "i" },
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

  // Lookup likes
  pipeline.push({
    $lookup: {
      from: "likes",
      localField: "_id",
      foreignField: "tweet",
      as: "likes",
    },
  });

  pipeline.push({
    $addFields: {
      owner: { $first: "$owner" },
      likesCount: { $size: "$likes" },
      isLiked: {
        $cond: {
          if: { $in: [req.user?._id, "$likes.likedBy"] },
          then: true,
          else: false,
        },
      },
    },
  });

  // Sort
  pipeline.push({
    $sort: {
      [sortBy]: sortType === "desc" ? -1 : 1,
    },
  });

  pipeline.push({
    $project: {
      content: 1,
      createdAt: 1,
      updatedAt: 1,
      owner: 1,
      likesCount: 1,
      isLiked: 1,
    },
  });

  const aggregate = Tweet.aggregate(pipeline);
  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
  };

  const tweets = await Tweet.aggregatePaginate(aggregate, options);

  return res
    .status(200)
    .json(new APIresponse(200, tweets, "Tweets retrieved successfully"));
});

// Get tweet by ID
const getTweetById = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  if (!tweetId) {
    throw new APIerror(400, "Tweet ID is required");
  }

  if (!mongoose.isValidObjectId(tweetId)) {
    throw new APIerror(400, "Invalid tweet ID");
  }

  const tweet = await Tweet.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(tweetId),
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
        foreignField: "tweet",
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

  if (!tweet?.length) {
    throw new APIerror(404, "Tweet not found");
  }

  return res
    .status(200)
    .json(new APIresponse(200, tweet[0], "Tweet retrieved successfully"));
});

// Get tweets from subscribed channels (timeline/feed for logged in user)
const getSubscribedTweets = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const aggregateQuery = Tweet.aggregate([
    {
      $lookup: {
        from: "subscriptions",
        localField: "owner",
        foreignField: "channel",
        as: "subscription",
        pipeline: [
          {
            $match: {
              subscriber: req.user._id,
            },
          },
        ],
      },
    },
    {
      $match: {
        $or: [
          { "subscription.0": { $exists: true } }, // From subscribed channels
          { owner: req.user._id }, // User's own tweets
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
        foreignField: "tweet",
        as: "likes",
      },
    },
    {
      $addFields: {
        owner: { $first: "$owner" },
        likesCount: { $size: "$likes" },
        isLiked: {
          $cond: {
            if: { $in: [req.user._id, "$likes.likedBy"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $sort: {
        createdAt: -1,
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
        subscription: 0,
      },
    },
  ]);

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
  };

  const tweets = await Tweet.aggregatePaginate(aggregateQuery, options);

  return res
    .status(200)
    .json(new APIresponse(200, tweets, "Subscribed tweets retrieved successfully"));
});

export {
  createTweet,
  getUserTweets,
  updateTweet,
  deleteTweet,
  getAllTweets,
  getTweetById,
  getSubscribedTweets,
};
