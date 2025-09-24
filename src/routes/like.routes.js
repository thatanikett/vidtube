import { Router } from "express";
import {
  toggleVideoLike,
  toggleCommentLike,
  toggleTweetLike,
  getLikedVideos,
  getLikedComments,
  getLikedTweets,
  getLikeStatus,
  getLikeCount,
  getUserLikeSummary,
} from "../controllers/like.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Public routes
router.route("/count/:contentType/:contentId").get(getLikeCount);

// All other routes require authentication
router.use(verifyJWT);

// Toggle like routes
router.route("/toggle/v/:videoId").post(toggleVideoLike);
router.route("/toggle/c/:commentId").post(toggleCommentLike);
router.route("/toggle/t/:tweetId").post(toggleTweetLike);

// Get liked content routes
router.route("/videos").get(getLikedVideos);
router.route("/comments").get(getLikedComments);
router.route("/tweets").get(getLikedTweets);

// Like status and summary routes
router.route("/status/:contentType/:contentId").get(getLikeStatus);
router.route("/summary").get(getUserLikeSummary);

export default router;
