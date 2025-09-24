import { Router } from "express";
import {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
  getAllPlaylists,
} from "../controllers/playlist.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Public routes
router.route("/").get(getAllPlaylists);
router.route("/:playlistId").get(getPlaylistById);
router.route("/user/:userId").get(getUserPlaylists);

// Secured routes
router.route("/").post(verifyJWT, createPlaylist);
router.route("/:playlistId").patch(verifyJWT, updatePlaylist);
router.route("/:playlistId").delete(verifyJWT, deletePlaylist);
router.route("/add/:videoId/:playlistId").patch(verifyJWT, addVideoToPlaylist);
router.route("/remove/:videoId/:playlistId").patch(verifyJWT, removeVideoFromPlaylist);

export default router;
