import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { StorageUnavailableError } from "@/lib/errors"
import { readS3Config, type S3Config } from "./s3-config"

export type ObjectStorage = {
  bucket: string
  maxUploadBytes: number
  putObject(input: { key: string; body: Buffer; contentType: string }): Promise<void>
  getObject(key: string): Promise<Buffer>
  deleteObject(key: string): Promise<void>
  headBucket(): Promise<void>
}

export function logS3Failure(err: unknown): void {
  const meta =
    typeof err === "object" && err !== null && "$metadata" in err
      ? (err as { $metadata?: { httpStatusCode?: number } }).$metadata
      : undefined
  console.error("s3 operation failed", {
    name: err instanceof Error ? err.name : "Error",
    status: meta?.httpStatusCode,
  })
}

async function sendOrUnavailable<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (err) {
    if (err instanceof StorageUnavailableError) throw err
    logS3Failure(err)
    throw new StorageUnavailableError()
  }
}

export function createObjectStorage(config: S3Config = readS3Config()): ObjectStorage {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  })
  const abort = () => AbortSignal.timeout(config.requestTimeoutMs)

  return {
    bucket: config.bucket,
    maxUploadBytes: config.maxUploadBytes,
    async putObject(input) {
      await sendOrUnavailable(() =>
        client.send(
          new PutObjectCommand({
            Bucket: config.bucket,
            Key: input.key,
            Body: input.body,
            ContentLength: input.body.length,
            ContentType: input.contentType,
          }),
          { abortSignal: abort() }
        )
      )
    },
    async getObject(key) {
      const out = await sendOrUnavailable(() =>
        client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }), { abortSignal: abort() })
      )
      if (!out.Body) throw new StorageUnavailableError()
      return Buffer.from(await out.Body.transformToByteArray())
    },
    async deleteObject(key) {
      await sendOrUnavailable(() =>
        client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }), { abortSignal: abort() })
      )
    },
    async headBucket() {
      await sendOrUnavailable(() =>
        client.send(new HeadBucketCommand({ Bucket: config.bucket }), { abortSignal: abort() })
      )
    },
  }
}
