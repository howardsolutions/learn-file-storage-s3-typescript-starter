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

# Using the Filesystem

<details>
<summary>Why not store images as base64 in SQLite?</summary>

We're using `base64` strings in our SQLite database to store images... let's talk about why that actually kinda sucks:

1. **CPU performance:** Base64 encoding is an expensive, CPU-intensive operation. If we have a lot of uploads (and we're hoping to be successful, right?), this can become a real scaling issue.
2. **Storage costs:** Base64 encoding increases the size of the image data. We're using more disk space than necessary, which is both expensive and slow.
3. **Database performance:** Databases (especially relational databases like SQLite, Postgres, and MySQL) are optimized for small, structured data—not giant blobs of binary data. This can seriously impact query performance.
4. **Caching:** Base64 encoded images aren't as cache friendly as raw files, meaning slower load times and higher bandwidth costs.

It's usually a bad idea to store large binary blobs in a database. There are exceptions, but they are rare.

**So what's the solution?**  
Store the files on the filesystem! File systems are optimized for storing and serving files—and they do it very well.

</details>

## Mime Types

A mime type is just a web-friendly way to describe format of a file. It's kind of like a file extension, but more standardized and built for the web.

Mime types have a type and a subtype, separated by a /. For example:

image/png
video/mp4
audio/mp3
text/html

When a browser uploads a file via a multipart form, it sends the file's mime type in the Content-Type header.

# CACHE

## Cache Headers

Query strings are a great way to brute force cache controls as the client - but the best way (assuming you have control of the server, and c'mon, we're backend devs), is to use the `Cache-Control` header.

Some common values are:

- no-store: Don't cache this at all

- max-age=3600: Cache this for 1 hour (3600 seconds)

- stale-while-revalidate: Serve stale content while revalidating the cache

- no-cache: Does not mean "don't cache this". It means "cache this, but REVALIDATE it BEFORE SERVING it again"

When the server sends Cache-Control headers, it's up to the browser to respect them, but most modern browsers do.

