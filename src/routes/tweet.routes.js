import { Router } from "express";
import {
  createTweet,
  getUserTweets,
  updateTweet,
  deleteTweet,
  getAllTweets,
  getTweetById,
  getSubscribedTweets,
} from "../controllers/tweet.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Public routes
router.route("/").get(getAllTweets);
router.route("/:tweetId").get(getTweetById);
router.route("/user/:userId").get(getUserTweets);

// Secured routes
router.route("/").post(verifyJWT, createTweet);
router.route("/:tweetId").patch(verifyJWT, updateTweet);
router.route("/:tweetId").delete(verifyJWT, deleteTweet);
router.route("/feed/subscribed").get(verifyJWT, getSubscribedTweets);

export default router;
