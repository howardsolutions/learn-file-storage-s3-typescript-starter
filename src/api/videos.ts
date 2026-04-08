import type { BunRequest } from "bun";
import { rm } from "node:fs/promises";
import path from "node:path";
import { getBearerToken, validateJWT } from "../auth";
import type { ApiConfig } from "../config";
import { getVideo, updateVideo } from "../db/videos";
import { uploadVideoToS3 } from "../s3";
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

async function getVideoAspectRatio(filePath: string): Promise<string> {
  const proc = Bun.spawn([
    "ffprobe",
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "json",
    filePath,
  ], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdoutText = await new Response(proc.stdout).text();
  const stderrText = await new Response(proc.stderr).text();
  const exited = await proc.exited;

  if (exited !== 0) {
    throw new BadRequestError(
      `Failed to inspect video file with ffprobe: ${stderrText || stdoutText}`,
    );
  }

  type ProbeOutput = {
    streams?: Array<{ width?: number; height?: number }>;
  };

  let parsedOutput: ProbeOutput;
  try {
    parsedOutput = JSON.parse(stdoutText) as ProbeOutput;
  } catch {
    throw new BadRequestError("Failed to parse ffprobe output");
  }

  const width = parsedOutput.streams?.[0]?.width;
  const height = parsedOutput.streams?.[0]?.height;
  if (!width || !height) {
    throw new BadRequestError("Could not determine video dimensions");
  }

  const ratio = width / height;
  const landscapeRatio = 16 / 9;
  const portraitRatio = 9 / 16;
  const tolerance = 0.05;

  if (Math.abs(ratio - landscapeRatio) <= tolerance) {
    return "landscape";
  }

  if (Math.abs(ratio - portraitRatio) <= tolerance) {
    return "portrait";
  }

  return "other";
}

async function processVideoForFastStart(inputFilePath: string): Promise<string> {
  const outputFilePath = `${inputFilePath}.processed`;

  const proc = Bun.spawn([
    "ffmpeg",
    "-i",
    inputFilePath,
    "-movflags",
    "faststart",
    "-map_metadata",
    "0",
    "-codec",
    "copy",
    "-f",
    "mp4",
    outputFilePath,
  ], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdoutText = await new Response(proc.stdout).text();
  const stderrText = await new Response(proc.stderr).text();
  const exited = await proc.exited;

  if (exited !== 0) {
    throw new BadRequestError(
      `Failed to process video for fast start with ffmpeg: ${stderrText || stdoutText}`,
    );
  }

  return outputFilePath;
}

export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
  const MAX_UPLOAD_SIZE = 1 << 30;

  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

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
  if (file.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError("File exceeds size limit (1GB)");
  }
  if (file.type !== "video/mp4") {
    throw new BadRequestError("Invalid file type, only MP4 is allowed");
  }

  const tempFilePath = path.join("/tmp", `${videoId}.mp4`);
  await Bun.write(tempFilePath, file);

  const aspectRatio = await getVideoAspectRatio(tempFilePath);
  const processedFilePath = await processVideoForFastStart(tempFilePath);

  const key = `${aspectRatio}/${videoId}.mp4`;
  await uploadVideoToS3(cfg, key, processedFilePath, "video/mp4");

  const videoURL = `https://${cfg.s3Bucket}.s3.${cfg.s3Region}.amazonaws.com/${key}`;
  video.videoURL = videoURL;
  updateVideo(cfg.db, video);

  await Promise.all([
    rm(tempFilePath, { force: true }),
    rm(`${tempFilePath}.processed.mp4`, { force: true }),
  ]);
  
  return respondWithJSON(200, video);
}
