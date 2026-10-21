import express from "express";
import multer from "multer";
import { uploadFile } from "./uploads.controller.js";
import { rateLimit } from "../auth/rate-limit.js";

const router = express.Router();

// Allowed document formats: PDF, images, Word (.doc/.docx), Excel (.xls/.xlsx),
// PowerPoint, CSV and plain text. Browsers sometimes report lesser-known office
// files (e.g. legacy .doc/.xls) as application/octet-stream, so those are
// accepted when the original file extension is on the allow-list.
const allowedMimeTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/csv",
  "text/csv",
  "text/plain",
  "application/rtf",
  "application/json",
  "application/zip",
]);

const allowedExtensions = new Set([
  ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif",
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".csv", ".txt", ".rtf", ".json", ".zip",
]);

const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const extension = file.originalname.includes(".")
      ? file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase()
      : "";
    const isAllowed =
      allowedMimeTypes.has(file.mimetype) ||
      (file.mimetype === "application/octet-stream" && allowedExtensions.has(extension));
    callback(null, isAllowed);
  },
});

router.post("/", rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }), upload.single("file"), uploadFile);

export default router;
