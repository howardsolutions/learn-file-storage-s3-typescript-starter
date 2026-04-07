import { randomBytes } from "node:crypto";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BunRequest } from "bun";
import { getBearerToken, validateJWT } from "../auth";
import type { ApiConfig } from "../config";
import { getVideo, updateVideo } from "../db/videos";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import { respondWithJSON } from "./json";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseVideoId(videoId: string | undefined): string {
  if (!videoId || !UUID_RE.test(videoId)) {
    throw new BadRequestError("Invalid video ID");
  }
  return videoId;
}

export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
  const MAX_UPLOAD_BYTES = 1 << 30;

  const videoId = parseVideoId((req.params as { videoId?: string }).videoId);

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  const video = getVideo(cfg.db, videoId);

  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }

  if (video.userID !== userID) {
    throw new UserForbiddenError("Not authorized to update this video");
  }

  const formData = await req.formData();
  const file = formData.get("video");

  if (!(file instanceof File)) {
    throw new BadRequestError("Video file missing");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new BadRequestError("Video file exceeds the maximum allowed size of 1GB");
  }

  if (file.type !== "video/mp4") {
    throw new BadRequestError("Invalid file type. Only MP4 video is allowed.");
  }

  const tempPath = join(tmpdir(), `video-upload-${randomBytes(16).toString("hex")}.mp4`);

  try {
    await Bun.write(tempPath, file);

    const key = `${randomBytes(16).toString("hex")}.mp4`;

    const s3File = cfg.s3Client.file(key, {
      bucket: cfg.s3Bucket,
      type: "video/mp4",
    });

    await s3File.write(Bun.file(tempPath), {
      type: "video/mp4",
    });

    const videoURL = `https://${cfg.s3Bucket}.s3.${cfg.s3Region}.amazonaws.com/${key}`;
    video.videoURL = videoURL;
    
    updateVideo(cfg.db, video);

    return respondWithJSON(200, video);
  } finally {
    await unlink(tempPath).catch(() => {});
  }
}
