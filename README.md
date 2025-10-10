# learn-file-storage-s3-typescript-starter (Tubely)

This repo contains the starter code for the Tubely application - the #1 tool for engagement bait - for the "Learn File Servers and CDNs with S3 and CloudFront"

## Quickstart

## 1. Install dependencies

- [Typescript](https://www.typescriptlang.org/)
- [Bun](https://bun.sh/)
- [FFMPEG](https://ffmpeg.org/download.html) - both `ffmpeg` and `ffprobe` are required to be in your `PATH`.

```bash
# linux
sudo apt update
sudo apt install ffmpeg

# mac
brew update
brew install ffmpeg
```

- [SQLite 3](https://www.sqlite.org/download.html) only required for you to manually inspect the database.

```bash
# linux
sudo apt update
sudo apt install sqlite3

# mac
brew update
brew install sqlite3
```

- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)

## 2. Download sample images and videos

```bash
./samplesdownload.sh
# samples/ dir will be created
# with sample images and videos
```

## 3. Configure environment variables

Copy the `.env.example` file to `.env` and fill in the values.

```bash
cp .env.example .env
```

You'll need to update values in the `.env` file to match your configuration, but _you won't need to do anything here until the course tells you to_.

## 3. Run the server

```bash
bun run src/index.ts
```

- You should see a new database file `tubely.db` created in the root directory.
- You should see a new `assets` directory created in the root directory, this is where the images will be stored.
- You should see a link in your console to open the local web page.

## LEARNING NOTES

<details>
<summary>Why do web applications need to handle large files?</summary>

Building a (good) web application almost always involves handling "large" files of some kind - whether it's static images and videos for a marketing site, or user generated content like profile pictures and video uploads, it always seems to come up.

In this project we'll cover strategies for handling files that are kilobytes, megabytes, or even gigabytes in size, as opposed to the small structured data that you might store in a traditional database (integers, booleans, and simple strings).
</details>

## Learning Goals
<details>
<summary>Learning Goals</summary>

- Understand what "large" files are and how they differ from "small" structured data
- Build an app that uses AWS S3 and Typescript to store and serve assets
- Learn how to manage files on a "normal" (non-s3) filesystem based application
- Learn how to store and serve asset AT SCALE using serverless solutions, like AWS S3
- Learn how to stream video and to keep data usage low and improve performance

</details>

## Large files

<details>
<summary>What are "large files" or "large assets"?</summary>

- "Large files" (or "large assets") are big blobs of data, usually encoded in a specific file format, and measured in kilobytes, megabytes, or gigabytes.

**As a simple rule:**
- If the data makes sense in an Excel spreadsheet, it probably belongs in a traditional database.
- If the data would normally be stored on your hard drive as its own file, it's probably a "large file".

**Large files are interesting because:**
- They are large in size (obviously), making them more performance-sensitive.
- They are often accessed frequently, and their size combined with frequent access can quickly lead to performance bottlenecks.

</details>

# Encoding

- we can actually encode the image as a `base64` string and shove the whole thing into a text column in SQLite. 
Base64 is just a way to encode binary (raw) data as text. It's not the most efficient way to do it, but it will work for now.