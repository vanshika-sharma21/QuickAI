import express from "express";
import { upload } from "../configs/multer.js";
import { auth } from "../middlewares/auth.js";

import {
  generateArticle,
  generateBlogTitle,
  generateImage,
  removeImageBackground,
  removeImageObject,
  resumeReview,
} from "../controllers/aiController.js";

const aiRouter = express.Router();

// ================= ARTICLE =================
aiRouter.post("/generate-article", auth, generateArticle);

// ================= BLOG TITLE =================
aiRouter.post("/generate-blog-title", auth, generateBlogTitle);

// ================= IMAGE GENERATION =================
aiRouter.post("/generate-image", auth, generateImage);

// ================= REMOVE BACKGROUND (FIXED) =================
aiRouter.post(
  "/remove-background",
  auth,
  upload.single("image"),
  removeImageBackground
);

// ================= REMOVE OBJECT =================
aiRouter.post(
  "/remove-image-object",
  auth,
  upload.single("image"),
  removeImageObject
);

// ================= RESUME REVIEW =================
aiRouter.post(
  "/resume-review",
  auth,
  upload.single("resume"),
  resumeReview
);

export default aiRouter;