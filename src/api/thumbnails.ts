import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";

type Thumbnail = {
  data: ArrayBuffer;
  mediaType: string;
};

const videoThumbnails: Map<string, Thumbnail> = new Map();

export async function handlerGetThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }

  const thumbnail = videoThumbnails.get(videoId);
  if (!thumbnail) {
    throw new NotFoundError("Thumbnail not found");
  }

  return new Response(thumbnail.data, {
    headers: {
      "Content-Type": thumbnail.mediaType,
      "Cache-Control": "no-store",
    },
  });
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

  // Save the thumbnail to the global map
  videoThumbnails.set(videoId, {
    data: imageData,
    mediaType: mediaType,
  });

  // Generate the thumbnail URL
  const thumbnailURL = `http://localhost:${cfg.port}/api/thumbnails/${videoId}`;

  // Update the video metadata with the new thumbnail URL
  const updatedVideo = {
    ...video,
    thumbnailURL: thumbnailURL,
  };
  
  updateVideo(cfg.db, updatedVideo);

  // Respond with updated video metadata
  return respondWithJSON(200, updatedVideo);
}
