import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import path from "path";

// Helper function to determine file extension from media type
function getFileExtensionFromMediaType(mediaType: string): string {
  // Only allow JPEG and PNG images
  if (mediaType === "image/jpeg" || mediaType === "image/jpg") {
    return "jpg";
  }
  
  if (mediaType === "image/png") {
    return "png";
  }
  
  throw new BadRequestError(`Only JPEG and PNG images are allowed. Received: ${mediaType}`);
}

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  // Parse the form data
  const formData = await req.formData();

  // Get the image data from the form
  const thumbnailFile = formData.get("thumbnail");
  
  // Validation 1: Check if it's a File instance
  if (!(thumbnailFile instanceof File)) {
    throw new BadRequestError("Thumbnail must be a file");
  }

  // Validation 2: Check max upload size (10MB)
  const MAX_UPLOAD_SIZE = 10 << 20; // 10MB
  if (thumbnailFile.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError("File size exceeds maximum allowed size of 10MB");
  } 

  // Get media type and determine file extension
  const mediaType = thumbnailFile.type;
  const fileExtension = getFileExtensionFromMediaType(mediaType);

  // Read image data into ArrayBuffer
  const imageData = await thumbnailFile.arrayBuffer();

  // Get video metadata
  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Video not found");
  } 

  // Authorization check: ensure user owns the video
  if (video.userID !== userID) {
    throw new UserForbiddenError("You don't have permission to upload thumbnails for this video");
  }

  // Create unique file path using videoID and file extension
  const fileName = `${videoId}.${fileExtension}`;
  const filePath = path.join(cfg.assetsRoot, fileName);

  // Save file to filesystem using Bun.write
  await Bun.write(filePath, imageData);

  // Create the new thumbnail URL
  const thumbnailURL = `http://localhost:${cfg.port}/assets/${fileName}`;

  // Update the video metadata with the new thumbnail URL
  const updatedVideo = {
    ...video,
    thumbnailURL: thumbnailURL,
  };
  
  updateVideo(cfg.db, updatedVideo);

  // Respond with updated video metadata
  return respondWithJSON(200, updatedVideo);
}
