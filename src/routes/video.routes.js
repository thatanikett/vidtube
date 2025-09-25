import { Router } from "express";
import {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
} from "../controllers/video.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middlewares.js";

const router = Router();

// Public routes
router.route("/").get(getAllVideos);
router.route("/:videoId").get(getVideoById);

// Secured routes
router.route("/").post(
  verifyJWT,
  upload.fields([
    { name: "videoFile", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  publishAVideo
);

router.route("/:videoId").patch(verifyJWT, updateVideo);
router.route("/:videoId").delete(verifyJWT, deleteVideo);
router.route("/toggle/publish/:videoId").patch(verifyJWT, togglePublishStatus);

export default router;
