import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";


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

  // Get media type
  const mediaType = thumbnailFile.type;

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

  // Convert ArrayBuffer to Buffer
  const buffer = Buffer.from(imageData);
  
  // Convert Buffer to base64 string
  const base64Data = buffer.toString("base64");
  
  // Create data URL with media type and base64 encoded image data
  const dataURL = `data:${mediaType};base64,${base64Data}`;

  // Update the video metadata with the data URL stored in thumbnail_url
  const updatedVideo = {
    ...video,
    thumbnailURL: dataURL,
  };
  
  updateVideo(cfg.db, updatedVideo);

  // Respond with updated video metadata
  return respondWithJSON(200, updatedVideo);
}
