import fs from "node:fs/promises"
import path from "node:path"
import {
	PutObjectCommand,
	type PutObjectCommandInput,
	S3Client
} from "@aws-sdk/client-s3"
import "dotenv/config"

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

async function uploadSearchDataToR2() {
	const timestamp = new Date()
		.toISOString()
		.replace(/[-:T.Z]/g, "")
		.slice(0, 14) // YYYYMMDDHHmmss format

	// Find the latest search data file in the search directory
	const searchDir = path.join(process.cwd(), "search")
	const files = await fs.readdir(searchDir)

	// Find the latest .json.gz file (not including any temporary files)
	const latestFile = files
		.filter(
			(f) =>
				f.endsWith(".json.gz") &&
				!f.includes("temp") &&
				f.includes("search-data")
		)
		.sort()
		.pop()

	if (!latestFile) {
		console.error("No search data files found in the search directory")
		process.exit(1)
	}

	const localFilePath = path.join(searchDir, latestFile)
	const r2FileName = `search-data-v${timestamp}.json.gz`

	console.log(`Uploading ${localFilePath} to R2 as ${r2FileName}...`)

	try {
		// Create S3 client for Cloudflare R2
		const s3Client = new S3Client({
			region: "auto",
			endpoint: `https://${r2Config.accountId}.r2.cloudflarestorage.com`,
			credentials: {
				accessKeyId: r2Config.accessKeyId,
				secretAccessKey: r2Config.secretAccessKey
			}
		})

		// Read file content
		const fileContent = await fs.readFile(localFilePath)

		// Upload file to R2
		const uploadParams = {
			Bucket: r2Config.bucketName,
			Key: `search-data/${r2FileName}`,
			Body: fileContent,
			ContentType: "application/gzip"
		}

		const uploadCommand = new PutObjectCommand(uploadParams)
		await s3Client.send(uploadCommand)
		console.log("File uploaded successfully")

		// Update version file in R2
		await updateVersionFile(timestamp, r2FileName)

		console.log("Upload completed successfully!")
	} catch (err) {
		console.error("Failed to upload search data:", err)
		process.exit(1)
	}
}

async function updateVersionFile(timestamp: string, fileName: string) {
	// Create version info object
	const versionInfo = {
		version: timestamp,
		dataPath: `${r2Config.publicUrl}/search-data/${fileName}`,
		lastUpdated: new Date().toISOString()
	}

	// Create S3 client for Cloudflare R2
	const s3Client = new S3Client({
		region: "auto",
		endpoint: `https://${r2Config.accountId}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: r2Config.accessKeyId,
			secretAccessKey: r2Config.secretAccessKey
		}
	})

	try {
		// First, update the local version file
		const localVersionPath = path.join(process.cwd(), "search", "version.json")
		await fs.writeFile(
			localVersionPath,
			JSON.stringify(versionInfo, null, 2),
			"utf-8"
		)
		console.log("Local version file updated:", versionInfo)

		// Then upload the version file to R2
		const uploadParams: PutObjectCommandInput = {
			Bucket: r2Config.bucketName,
			Key: "version.json",
			Body: JSON.stringify(versionInfo),
			ContentType: "application/json",
			// Make the version file readable by anyone
			ACL: "public-read"
		}

		const uploadCommand = new PutObjectCommand(uploadParams)
		await s3Client.send(uploadCommand)
		console.log("R2 version file updated successfully")
	} catch (err) {
		console.error("Failed to update version file:", err)
		throw err
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
	uploadSearchDataToR2().catch(console.error)
} else {
	process.exit(1)
}
