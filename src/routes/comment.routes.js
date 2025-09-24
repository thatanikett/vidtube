import { Router } from "express";
import {
  getVideoComments,
  addComment,
  updateComment,
  deleteComment,
  getUserComments,
  getCommentById,
} from "../controllers/comment.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Public routes
router.route("/video/:videoId").get(getVideoComments);
router.route("/user/:userId").get(getUserComments);
router.route("/:commentId").get(getCommentById);

// Secured routes
router.route("/video/:videoId").post(verifyJWT, addComment);
router.route("/:commentId").patch(verifyJWT, updateComment);
router.route("/:commentId").delete(verifyJWT, deleteComment);

export default router;
