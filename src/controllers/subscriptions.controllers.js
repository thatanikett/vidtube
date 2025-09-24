import { asyncHandler } from "../utils/asyncHandler.js";
import { APIerror } from "../utils/APIerror.js";
import { APIresponse } from "../utils/APIresponse.js";
import { Subscription } from "../models/subscriptions.models.js";
import { User } from "../models/user.models.js";
import mongoose from "mongoose";

// Toggle subscription - subscribe/unsubscribe to a channel
const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const subscriberId = req.user._id;

  if (!channelId) {
    throw new APIerror(400, "Channel ID is required");
  }

  if (!mongoose.isValidObjectId(channelId)) {
    throw new APIerror(400, "Invalid channel ID");
  }

  // Check if channel exists
  const channel = await User.findById(channelId);
  if (!channel) {
    throw new APIerror(404, "Channel not found");
  }

  // Prevent users from subscribing to themselves
  if (channelId === subscriberId.toString()) {
    throw new APIerror(400, "Cannot subscribe to your own channel");
  }

  // Check if subscription already exists
  const existingSubscription = await Subscription.findOne({
    subscriber: subscriberId,
    channel: channelId,
  });

  if (existingSubscription) {
    // Unsubscribe
    await Subscription.findByIdAndDelete(existingSubscription._id);
    return res
      .status(200)
      .json(new APIresponse(200, { subscribed: false }, "Unsubscribed successfully"));
  } else {
    // Subscribe
    const subscription = await Subscription.create({
      subscriber: subscriberId,
      channel: channelId,
    });

    return res
      .status(201)
      .json(new APIresponse(201, { subscribed: true, subscription }, "Subscribed successfully"));
  }
});

// Get subscriber list for a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (!channelId) {
    throw new APIerror(400, "Channel ID is required");
  }

  if (!mongoose.isValidObjectId(channelId)) {
    throw new APIerror(400, "Invalid channel ID");
  }

  // Check if channel exists
  const channel = await User.findById(channelId);
  if (!channel) {
    throw new APIerror(404, "Channel not found");
  }

  const aggregateQuery = Subscription.aggregate([
    {
      $match: {
        channel: new mongoose.Types.ObjectId(channelId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "subscriber",
        foreignField: "_id",
        as: "subscriber",
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
      $unwind: "$subscriber",
    },
    {
      $project: {
        _id: 1,
        subscriber: 1,
        createdAt: 1,
      },
    },
  ]);

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
  };

  const subscribers = await Subscription.aggregatePaginate(aggregateQuery, options);

  return res
    .status(200)
    .json(new APIresponse(200, subscribers, "Channel subscribers fetched successfully"));
});

// Get channels subscribed by user
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (!subscriberId) {
    throw new APIerror(400, "Subscriber ID is required");
  }

  if (!mongoose.isValidObjectId(subscriberId)) {
    throw new APIerror(400, "Invalid subscriber ID");
  }

  // Check if user exists
  const user = await User.findById(subscriberId);
  if (!user) {
    throw new APIerror(404, "User not found");
  }

  const aggregateQuery = Subscription.aggregate([
    {
      $match: {
        subscriber: new mongoose.Types.ObjectId(subscriberId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "channel",
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
            },
          },
          {
            $project: {
              username: 1,
              fullName: 1,
              avatar: 1,
              subscribersCount: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: "$channel",
    },
    {
      $project: {
        _id: 1,
        channel: 1,
        createdAt: 1,
      },
    },
  ]);

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
  };

  const subscriptions = await Subscription.aggregatePaginate(aggregateQuery, options);

  return res
    .status(200)
    .json(new APIresponse(200, subscriptions, "Subscribed channels fetched successfully"));
});

// Check subscription status
const getSubscriptionStatus = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const subscriberId = req.user._id;

  if (!channelId) {
    throw new APIerror(400, "Channel ID is required");
  }

  if (!mongoose.isValidObjectId(channelId)) {
    throw new APIerror(400, "Invalid channel ID");
  }

  const subscription = await Subscription.findOne({
    subscriber: subscriberId,
    channel: channelId,
  });

  return res
    .status(200)
    .json(
      new APIresponse(
        200,
        { isSubscribed: !!subscription },
        "Subscription status retrieved successfully"
      )
    );
});

// Get subscription count for a channel
const getChannelSubscriberCount = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!channelId) {
    throw new APIerror(400, "Channel ID is required");
  }

  if (!mongoose.isValidObjectId(channelId)) {
    throw new APIerror(400, "Invalid channel ID");
  }

  // Check if channel exists
  const channel = await User.findById(channelId);
  if (!channel) {
    throw new APIerror(404, "Channel not found");
  }

  const subscriberCount = await Subscription.countDocuments({
    channel: channelId,
  });

  return res
    .status(200)
    .json(
      new APIresponse(
        200,
        { subscriberCount },
        "Channel subscriber count retrieved successfully"
      )
    );
});

export {
  toggleSubscription,
  getUserChannelSubscribers,
  getSubscribedChannels,
  getSubscriptionStatus,
  getChannelSubscriberCount,
};
