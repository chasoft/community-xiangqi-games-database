// filepath: /home/brian/projects/community-xiangqi-games-database/src/upload-screenshots.ts
import fs from "node:fs/promises"
import path from "node:path"
import {
	PutObjectCommand,
	ListObjectsV2Command,
	type PutObjectCommandInput,
	S3Client
} from "@aws-sdk/client-s3"
import "dotenv/config"

// Helper function to log progress to console
function logProgress(
	uploadedFiles: number,
	skippedFiles: number,
	currentIndex: number,
	totalFiles: number
) {
	const percentComplete = (((currentIndex + 1) / totalFiles) * 100).toFixed(2)
	const remaining = totalFiles - currentIndex - 1

	console.log("\nProgress Update:")
	console.log(`Uploaded: ${uploadedFiles}`)
	console.log(`Skipped: ${skippedFiles}`)
	console.log(
		`Progress: ${percentComplete}% (${currentIndex + 1}/${totalFiles})`
	)
	console.log(`Remaining: ${remaining}`)
}

interface R2Config {
	accountId: string
	accessKeyId: string
	secretAccessKey: string
	bucketName: string
	publicUrl: string
}

const r2Config: R2Config = {
	accountId: process.env.R2_ACCOUNT_ID || "",
	accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
	secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
	bucketName: process.env.R2_BUCKET_NAME || "vietcotuong",
	publicUrl: process.env.R2_PUBLIC_URL || "https://r2.vietcotuong.com"
}

async function uploadScreenshotsToR2() {
	// Path to screenshots directory
	const screenshotsDir = "/home/brian/projects/screenshots"
	// Batch size for processing files
	const BATCH_SIZE = 50
	// Log frequency (how often to log progress)
	const LOG_FREQUENCY = 10
	// Number of concurrent uploads
	const CONCURRENT_UPLOADS = 5

	try {
		// Get list of files in the screenshots directory
		const files = await fs.readdir(screenshotsDir)

		// Create S3 client for Cloudflare R2
		const s3Client = new S3Client({
			region: "auto",
			endpoint: `https://${r2Config.accountId}.r2.cloudflarestorage.com`,
			credentials: {
				accessKeyId: r2Config.accessKeyId,
				secretAccessKey: r2Config.secretAccessKey
			}
		})

		// Get list of existing files in R2 to avoid re-uploading
		const existingFiles = await getExistingFiles(s3Client)
		console.log(`Found ${existingFiles.size} existing files in R2`)

		// Track progress
		const totalFiles = files.length
		let uploadedFiles = 0
		let skippedFiles = 0
		let currentIndex = 0

		console.log(`Found ${totalFiles} files to process`)

		// Process files in batches with concurrent uploads
		for (
			let batchStart = 0;
			batchStart < files.length;
			batchStart += BATCH_SIZE
		) {
			const batchEnd = Math.min(batchStart + BATCH_SIZE, files.length)
			const batchFiles = files.slice(batchStart, batchEnd)

			console.log(
				`\nProcessing batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(files.length / BATCH_SIZE)}...`
			)

			// Process files in this batch concurrently
			const batchPromises = []

			for (let i = 0; i < batchFiles.length; i += CONCURRENT_UPLOADS) {
				const concurrentBatch = batchFiles.slice(i, i + CONCURRENT_UPLOADS)
				const concurrentPromises = concurrentBatch.map(async (fileName) => {
					const filePath = path.join(screenshotsDir, fileName)
					const r2Key = `screenshots/${fileName}`
					const fileIndex = batchStart + i + concurrentBatch.indexOf(fileName)

					// Skip if file already exists in R2
					if (existingFiles.has(r2Key)) {
						console.log(`Skipping ${fileName} - already exists in R2`)
						skippedFiles++
						return
					}

					// Get file stats to check if it's a file (not a directory)
					try {
						const stats = await fs.stat(filePath)
						if (!stats.isFile()) {
							console.log(`Skipping ${fileName} - not a file`)
							skippedFiles++
							return
						}

						// Read file content
						const fileContent = await fs.readFile(filePath)

						// Determine content type based on file extension
						const contentType = getContentType(fileName)

						// Upload file to R2
						const uploadParams: PutObjectCommandInput = {
							Bucket: r2Config.bucketName,
							Key: r2Key,
							Body: fileContent,
							ContentType: contentType,
							ACL: "public-read"
						}

						const uploadCommand = new PutObjectCommand(uploadParams)
						await s3Client.send(uploadCommand)

						uploadedFiles++
						currentIndex = fileIndex

						console.log(`Uploaded ${fileName} (${uploadedFiles} total)`)
					} catch (err) {
						console.error(`Failed to upload ${fileName}:`, err)
					}
				})

				// Wait for this group of concurrent uploads to complete
				await Promise.all(concurrentPromises)
				batchPromises.push(...concurrentPromises)
			}

			// Wait for all uploads in this batch to complete
			await Promise.all(batchPromises)

			// Log progress after each batch
			logProgress(uploadedFiles, skippedFiles, currentIndex, totalFiles)

			// Small delay between batches
			console.log("Completed batch. Taking a short break...")
			await new Promise((resolve) => setTimeout(resolve, 1000))
		}

		// Final progress update
		logProgress(uploadedFiles, skippedFiles, currentIndex, totalFiles)

		console.log("\nUpload Summary:")
		console.log(`Total files processed: ${totalFiles}`)
		console.log(`Uploaded successfully: ${uploadedFiles}`)
		console.log(`Skipped (already exists or not a file): ${skippedFiles}`)
		console.log(`Failed: ${totalFiles - uploadedFiles - skippedFiles}`)
		console.log("\nAll screenshots have been processed!")
	} catch (err) {
		console.error("Failed to upload screenshots:", err)
		process.exit(1)
	}
}

async function getExistingFiles(s3Client: S3Client): Promise<Set<string>> {
	const existingFiles = new Set<string>()
	let continuationToken: string | undefined

	try {
		do {
			const listCommand = new ListObjectsV2Command({
				Bucket: r2Config.bucketName,
				Prefix: "screenshots/",
				ContinuationToken: continuationToken
			})

			const response = await s3Client.send(listCommand)

			if (response.Contents) {
				for (const item of response.Contents) {
					if (item.Key) {
						existingFiles.add(item.Key)
					}
				}
			}

			continuationToken = response.NextContinuationToken
		} while (continuationToken)

		return existingFiles
	} catch (err) {
		console.error("Error getting existing files:", err)
		return new Set<string>()
	}
}

function getContentType(fileName: string): string {
	const ext = path.extname(fileName).toLowerCase()
	switch (ext) {
		case ".jpg":
		case ".jpeg":
			return "image/jpeg"
		case ".png":
			return "image/png"
		case ".gif":
			return "image/gif"
		case ".webp":
			return "image/webp"
		default:
			return "application/octet-stream"
	}
}

function validateConfig() {
	const required = [
		"accountId",
		"accessKeyId",
		"secretAccessKey",
		"bucketName",
		"publicUrl"
	]

	for (const key of required) {
		if (
			!r2Config[key as keyof R2Config] ||
			r2Config[key as keyof R2Config] === `your-${key.replace(/Id$/, "-id")}`
		) {
			console.error(`Missing R2 configuration: ${key}`)
			console.error(
				`Please set R2_${key.toUpperCase()} environment variable or update the script`
			)
			return false
		}
	}
	return true
}

if (validateConfig()) {
	uploadScreenshotsToR2().catch(console.error)
} else {
	process.exit(1)
}
