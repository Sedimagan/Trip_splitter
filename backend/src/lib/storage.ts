import fs from "fs";
import path from "path";
import crypto from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { env } from "./env";

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");

const s3Configured = !!(env.s3.bucket && env.s3.accessKeyId && env.s3.secretAccessKey);

const s3Client = s3Configured
  ? new S3Client({
      region: env.s3.region,
      endpoint: env.s3.endpoint,
      credentials: {
        accessKeyId: env.s3.accessKeyId!,
        secretAccessKey: env.s3.secretAccessKey!,
      },
    })
  : null;

export const usingObjectStorage = s3Configured;

function extFor(mimetype: string): string {
  if (mimetype === "image/png") return ".png";
  if (mimetype === "image/webp") return ".webp";
  if (mimetype === "image/heic" || mimetype === "image/heif") return ".heic";
  return ".jpg";
}

/** Stores an uploaded receipt image and returns a URL the client can load it
 * from. Uses S3-compatible object storage when configured (required in
 * production, since most hosts have an ephemeral filesystem); otherwise
 * falls back to local disk for local development. */
export async function storeReceiptImage(buffer: Buffer, mimetype: string): Promise<string> {
  const filename = `${crypto.randomUUID()}${extFor(mimetype)}`;

  if (s3Client) {
    const key = `receipts/${filename}`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: env.s3.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      })
    );
    if (env.s3.publicUrlBase) {
      return `${env.s3.publicUrlBase.replace(/\/$/, "")}/${key}`;
    }
    const endpoint = env.s3.endpoint ? new URL(env.s3.endpoint).host : `s3.${env.s3.region}.amazonaws.com`;
    return `https://${env.s3.bucket}.${endpoint}/${key}`;
  }

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
  return `/uploads/${filename}`;
}
