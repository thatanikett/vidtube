import { Router } from "express";
import {
  toggleSubscription,
  getUserChannelSubscribers,
  getSubscribedChannels,
  getSubscriptionStatus,
  getChannelSubscriberCount,
} from "../controllers/subscriptions.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Public routes (no authentication required)
router.route("/count/:channelId").get(getChannelSubscriberCount);
router.route("/c/:channelId/subscribers").get(getUserChannelSubscribers);

// Secured routes (authentication required)
router.route("/c/:channelId").post(verifyJWT, toggleSubscription);
router.route("/status/:channelId").get(verifyJWT, getSubscriptionStatus);
router.route("/u/:subscriberId").get(verifyJWT, getSubscribedChannels);

export default router;
