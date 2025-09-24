import { asyncHandler } from "../utils/asyncHandler.js";
import { APIerror } from "../utils/APIerror.js";
import { APIresponse } from "../utils/APIresponse.js";
import { Playlist } from "../models/playlist.models.js";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.models.js";
import mongoose from "mongoose";

// Create playlist
const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name?.trim()) {
    throw new APIerror(400, "Playlist name is required");
  }

  if (!description?.trim()) {
    throw new APIerror(400, "Playlist description is required");
  }

  const playlist = await Playlist.create({
    name: name.trim(),
    description: description.trim(),
    owner: req.user._id,
    videos: [],
  });

  const createdPlaylist = await Playlist.findById(playlist._id).populate(
    "owner",
    "username fullName avatar"
  );

  return res
    .status(201)
    .json(new APIresponse(201, createdPlaylist, "Playlist created successfully"));
});

// Get user playlists
const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 10 } = req.query;

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

  const aggregateQuery = Playlist.aggregate([
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
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videos",
        pipeline: [
          {
            $match: {
              isPublished: true,
            },
          },
          {
            $project: {
              _id: 1,
              title: 1,
              thumbnail: 1,
              duration: 1,
              views: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        owner: {
          $first: "$owner",
        },
        videoCount: {
          $size: "$videos",
        },
        firstVideo: {
          $first: "$videos",
        },
      },
    },
    {
      $project: {
        name: 1,
        description: 1,
        owner: 1,
        videoCount: 1,
        firstVideo: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
    {
      $sort: {
        updatedAt: -1,
      },
    },
  ]);

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
  };

  const playlists = await Playlist.aggregatePaginate(aggregateQuery, options);

  return res
    .status(200)
    .json(new APIresponse(200, playlists, "User playlists retrieved successfully"));
});

// Get playlist by id
const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!playlistId) {
    throw new APIerror(400, "Playlist ID is required");
  }

  if (!mongoose.isValidObjectId(playlistId)) {
    throw new APIerror(400, "Invalid playlist ID");
  }

  const playlist = await Playlist.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(playlistId),
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
        localField: "videos",
        foreignField: "_id",
        as: "videos",
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
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
    {
      $addFields: {
        owner: {
          $first: "$owner",
        },
        videoCount: {
          $size: "$videos",
        },
        totalDuration: {
          $sum: "$videos.duration",
        },
      },
    },
  ]);

  if (!playlist?.length) {
    throw new APIerror(404, "Playlist not found");
  }

  return res
    .status(200)
    .json(new APIresponse(200, playlist[0], "Playlist retrieved successfully"));
});

// Add video to playlist
const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!playlistId || !videoId) {
    throw new APIerror(400, "Playlist ID and Video ID are required");
  }

  if (!mongoose.isValidObjectId(playlistId) || !mongoose.isValidObjectId(videoId)) {
    throw new APIerror(400, "Invalid playlist ID or video ID");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new APIerror(404, "Playlist not found");
  }

  // Check if user owns the playlist
  if (playlist.owner.toString() !== req.user._id.toString()) {
    throw new APIerror(403, "You are not authorized to modify this playlist");
  }

  // Check if video exists and is published
  const video = await Video.findById(videoId);
  if (!video) {
    throw new APIerror(404, "Video not found");
  }

  if (!video.isPublished) {
    throw new APIerror(400, "Cannot add unpublished video to playlist");
  }

  // Check if video is already in playlist
  if (playlist.videos.includes(videoId)) {
    throw new APIerror(400, "Video already exists in playlist");
  }

  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $push: { videos: videoId },
    },
    { new: true }
  ).populate("owner", "username fullName avatar");

  return res
    .status(200)
    .json(new APIresponse(200, updatedPlaylist, "Video added to playlist successfully"));
});

// Remove video from playlist
const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!playlistId || !videoId) {
    throw new APIerror(400, "Playlist ID and Video ID are required");
  }

  if (!mongoose.isValidObjectId(playlistId) || !mongoose.isValidObjectId(videoId)) {
    throw new APIerror(400, "Invalid playlist ID or video ID");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new APIerror(404, "Playlist not found");
  }

  // Check if user owns the playlist
  if (playlist.owner.toString() !== req.user._id.toString()) {
    throw new APIerror(403, "You are not authorized to modify this playlist");
  }

  // Check if video exists in playlist
  if (!playlist.videos.includes(videoId)) {
    throw new APIerror(400, "Video not found in playlist");
  }

  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $pull: { videos: videoId },
    },
    { new: true }
  ).populate("owner", "username fullName avatar");

  return res
    .status(200)
    .json(new APIresponse(200, updatedPlaylist, "Video removed from playlist successfully"));
});

// Delete playlist
const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!playlistId) {
    throw new APIerror(400, "Playlist ID is required");
  }

  if (!mongoose.isValidObjectId(playlistId)) {
    throw new APIerror(400, "Invalid playlist ID");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new APIerror(404, "Playlist not found");
  }

  // Check if user owns the playlist
  if (playlist.owner.toString() !== req.user._id.toString()) {
    throw new APIerror(403, "You are not authorized to delete this playlist");
  }

  await Playlist.findByIdAndDelete(playlistId);

  return res
    .status(200)
    .json(new APIresponse(200, {}, "Playlist deleted successfully"));
});

// Update playlist
const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description } = req.body;

  if (!playlistId) {
    throw new APIerror(400, "Playlist ID is required");
  }

  if (!mongoose.isValidObjectId(playlistId)) {
    throw new APIerror(400, "Invalid playlist ID");
  }

  if (!name?.trim() && !description?.trim()) {
    throw new APIerror(400, "At least one field (name or description) is required");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new APIerror(404, "Playlist not found");
  }

  // Check if user owns the playlist
  if (playlist.owner.toString() !== req.user._id.toString()) {
    throw new APIerror(403, "You are not authorized to update this playlist");
  }

  const updateFields = {};
  if (name?.trim()) updateFields.name = name.trim();
  if (description?.trim()) updateFields.description = description.trim();

  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    { $set: updateFields },
    { new: true }
  ).populate("owner", "username fullName avatar");

  return res
    .status(200)
    .json(new APIresponse(200, updatedPlaylist, "Playlist updated successfully"));
});

// Get all playlists (public)
const getAllPlaylists = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy = "updatedAt", sortType = "desc" } = req.query;

  const pipeline = [];

  // Search by name or description
  if (query) {
    pipeline.push({
      $match: {
        $or: [
          { name: { $regex: query, $options: "i" } },
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

  // Lookup videos to get count and first video
  pipeline.push({
    $lookup: {
      from: "videos",
      localField: "videos",
      foreignField: "_id",
      as: "videos",
      pipeline: [
        {
          $match: {
            isPublished: true,
          },
        },
        {
          $project: {
            _id: 1,
            title: 1,
            thumbnail: 1,
            duration: 1,
          },
        },
      ],
    },
  });

  pipeline.push({
    $addFields: {
      owner: { $first: "$owner" },
      videoCount: { $size: "$videos" },
      firstVideo: { $first: "$videos" },
    },
  });

  // Filter out empty playlists
  pipeline.push({
    $match: {
      videoCount: { $gt: 0 },
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
      name: 1,
      description: 1,
      owner: 1,
      videoCount: 1,
      firstVideo: 1,
      createdAt: 1,
      updatedAt: 1,
    },
  });

  const aggregate = Playlist.aggregate(pipeline);
  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
  };

  const playlists = await Playlist.aggregatePaginate(aggregate, options);

  return res
    .status(200)
    .json(new APIresponse(200, playlists, "Playlists retrieved successfully"));
});

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
  getAllPlaylists,
};
