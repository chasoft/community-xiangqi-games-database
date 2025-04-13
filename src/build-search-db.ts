// filepath: /home/brian/projects/community-xiangqi-games-database/src/build-search-db.ts
import fs from "node:fs"
import path from "node:path"
import zlib from "node:zlib"

const DATA_DIR = path.resolve(process.cwd(), "data") // Base directory for groups/collections
const OUTPUT_DIR = path.resolve(process.cwd(), "search")

// Test mode configuration
const TEST_MODE = process.env.TEST_MODE === "true"
const TEST_FILE_LIMIT = 1000 // Number of files to process in test mode

/**
 * Represents a single Chinese Chess game record optimized for searching.
 */
export type SearchItem = {
	/** Unique identifier for the game (e.g., "collectionName/filename"). Primary Key in IndexedDB. */
	id: string

	/** The name of the collection (folder) the game belongs to. Indexed. */
	collectionName: string

	// --- Core Metadata (Likely Indexed & Searched) ---

	/** Game title (from DhtmlXQ_title). */
	title: string
	/** Event/Tournament name (from DhtmlXQ_event). Indexed. */
	event: string
	/** Original date string (from DhtmlXQ_date). */
	dateStr: string
	/** Extracted year from dateStr (e.g., 2023 or null if invalid/missing). Indexed. */
	eventYear: number | null
	/** Location of the game (from DhtmlXQ_place). */
	place: string
	/** Red player's name (from DhtmlXQ_red). Indexed. */
	redPlayer: string
	/** Black player's name (from DhtmlXQ_black). Indexed. */
	blackPlayer: string
	/** Opening name/classification (from DhtmlXQ_open). Potentially Indexed. */
	openingName: string
	/** Game result string (from DhtmlXQ_result). */
	result: string

	// --- Additional Metadata (Searched, Less Likely Indexed) ---

	/** Round information (from DhtmlXQ_round). */
	round: string
	/** Red player's team (from DhtmlXQ_redteam). */
	redTeam: string
	/** Black player's team (from DhtmlXQ_blackteam). */
	blackTeam: string
	/** Game type description (combined from DhtmlXQ_type, DhtmlXQ_gametype). */
	gameType: string
	/** Annotator/author (from DhtmlXQ_author). */
	author: string
	/** Source/owner (from DhtmlXQ_owner). */
	owner: string

	// --- Consolidated Text Content (For Fuzzy Search) ---

	/**
	 * Combined text from remarks (_remark) and all comments (_commentN, potentially others).
	 * This single field makes fuzzy searching across all annotations easier with Fuse.js.
	 */
	allTextContent: string

	// --- Essential Game Data (Optional inclusion based on size vs. utility) ---

	/** Main movelist string (from DhtmlXQ_movelist). */
	movelist: string
	/* Optional: Initial board FEN-like string (from DhtmlXQ_binit). */
	// binit?: string;

	/* We explicitly OMIT the raw variation strings (_move_A_B_C) here to save space */
	/* The full game might need to be fetched/accessed separately if needed */
}

// --- Helper Functions ---

/**
 * Parses the DhtmlXQ format content into a key-value object.
 * Simple line-based parsing. Assumes one tag per line.
 */
function parseDhtmlXQ(content: string): Record<string, string> {
	const data: Record<string, string> = {}
	const lines = content.split(/[\r\n]+/)
	const tagRegex = /^\[([a-zA-Z0-9_]+)\](.*?)(\[\/\1\])?$/

	for (const line of lines) {
		const match = line.trim().match(tagRegex)
		if (match) {
			const tagName = `_${match[1]}` // Prepend underscore for consistency
			const value = match[2]?.trim() ?? ""
			data[tagName] = value
		}
	}
	return data
}

/**
 * Extracts the year from a date string. Handles YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD, YYYYMMDD, or just YYYY.
 */
function extractYear(dateStr: string | undefined): number | null {
	if (!dateStr) return null
	const trimmedDate = dateStr.trim()

	// Match YYYY at the beginning or as the whole string
	const yearMatch = trimmedDate.match(/^(\d{4})/)
	if (yearMatch) {
		const year = Number.parseInt(yearMatch[1], 10)
		// Basic sanity check for a reasonable year range
		if (year > 1000 && year < 3000) {
			return year
		}
	}
	return null
}

/**
 * Recursively finds all game files in a directory, excluding README.md files.
 */
function findGameFiles(startPath: string, fileList: string[] = []): string[] {
	const files = fs.readdirSync(startPath)
	for (const file of files) {
		const filename = path.join(startPath, file)
		const stat = fs.lstatSync(filename)
		if (stat.isDirectory()) {
			findGameFiles(filename, fileList) // Recurse
		} else if (file.toLowerCase() !== "readme.md") {
			fileList.push(filename)
		}
	}
	return fileList
}

// --- Main Build Logic ---

async function buildSearchData() {
	console.log("Starting search data build...")
	console.log(`Scanning directory: ${DATA_DIR}`)

	if (!fs.existsSync(DATA_DIR)) {
		console.error(`Error: Data directory not found at ${DATA_DIR}`)
		process.exit(1)
	}

	const allGameFiles = findGameFiles(DATA_DIR)
	let totalFiles = allGameFiles.length
	console.log(`Found ${totalFiles} game files (excluding README.md files).`)

	if (totalFiles === 0) {
		console.warn("No game files found. Exiting.")
		return
	}

	// If in test mode, limit the number of files processed
	let filesToProcess = allGameFiles
	if (TEST_MODE && totalFiles > TEST_FILE_LIMIT) {
		filesToProcess = allGameFiles.slice(0, TEST_FILE_LIMIT)
		totalFiles = TEST_FILE_LIMIT
		console.log(`TEST MODE: Limiting processing to ${TEST_FILE_LIMIT} files.`)
	}

	const allSearchItems: SearchItem[] = []
	let processedCount = 0
	let errorCount = 0

	for (const filePath of filesToProcess) {
		try {
			const relativePath = path.relative(DATA_DIR, filePath)
			const pathParts = relativePath.split(path.sep)

			if (pathParts.length < 3) {
				console.warn(
					`Skipping file with unexpected path structure: ${relativePath}`
				)
				continue
			}

			const groupName = pathParts[0]
			const collectionFolderName = pathParts[1]
			const filename = pathParts[pathParts.length - 1]
			const collectionName = `${groupName}/${collectionFolderName}` // Combine group and collection

			const fileContent = fs.readFileSync(filePath, "utf-8")
			const parsedData = parseDhtmlXQ(fileContent)

			// Combine remarks and comments
			let allText = parsedData._remark || ""
			for (const key of Object.keys(parsedData)) {
				if (key.startsWith("_comment")) {
					allText += ` ${parsedData[key]}`
				}
			}

			const gameType = parsedData._type || parsedData._gametype || ""

			const searchItem: SearchItem = {
				id: `${collectionName}/${filename}`, // Unique ID - keep template literal here as it needs interpolation
				collectionName: collectionName,
				title: parsedData._title || "Untitled",
				event: parsedData._event || "",
				dateStr: parsedData._date || "",
				eventYear: extractYear(parsedData._date),
				place: parsedData._place || "",
				redPlayer: parsedData._red || "Unknown",
				blackPlayer: parsedData._black || "Unknown",
				openingName: parsedData._open || "",
				result: parsedData._result || "Unknown",
				round: parsedData._round || "",
				redTeam: parsedData._redteam || "",
				blackTeam: parsedData._blackteam || "",
				gameType: gameType,
				author: parsedData._author || "",
				owner: parsedData._owner || "",
				allTextContent: allText.trim(),
				movelist: parsedData._movelist || ""
				// binit: parsedData._binit || undefined, // Optional
			}

			allSearchItems.push(searchItem)
			processedCount++

			if (processedCount % 1000 === 0) {
				console.log(`Processed ${processedCount} / ${totalFiles} files...`)
			}
		} catch (error) {
			console.error(`Error processing file: ${filePath}`, error)
			errorCount++
		}
	}

	console.log(
		`Finished processing files. ${processedCount} successful, ${errorCount} failed.`
	)

	if (allSearchItems.length === 0) {
		console.error(
			"No search items were generated. Check for errors during processing."
		)
		process.exit(1)
	}

	// --- Versioning and Output ---
	const version = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 14) // YYYYMMDDHHmmss format
	const outputDataFilename = `search-data-v${version}.json`
	const outputCompressedFilename = `${outputDataFilename}.gz`
	const outputDataPath = path.join(OUTPUT_DIR, outputDataFilename)
	const outputCompressedPath = path.join(OUTPUT_DIR, outputCompressedFilename)

	try {
		console.log(`Creating output directory: ${OUTPUT_DIR}`)
		fs.mkdirSync(OUTPUT_DIR, { recursive: true })

		console.log(`Serializing ${allSearchItems.length} search items...`)
		const jsonData = JSON.stringify(allSearchItems)

		// Write uncompressed JSON file
		console.log(
			`Writing uncompressed data to: ${outputDataPath} (${(jsonData.length / (1024 * 1024)).toFixed(2)} MB)`
		)
		fs.writeFileSync(outputDataPath, jsonData)

		// Create compressed version
		console.log("Compressing data...")
		const compressedData = zlib.gzipSync(jsonData)

		console.log(
			`Writing compressed data to: ${outputCompressedPath} (${(compressedData.length / (1024 * 1024)).toFixed(2)} MB)`
		)
		fs.writeFileSync(outputCompressedPath, compressedData)

		console.log("\n✅ Search data build successful!")
		console.log(`   Version: ${version}`)
		console.log(`   Data file: ${outputDataPath}`)
		console.log(`   Compressed file: ${outputCompressedPath}`)
	} catch (error) {
		console.error("Error during output generation:", error)
		process.exit(1)
	}
}

// --- Run the build ---
buildSearchData().catch((error) => {
	console.error("Unhandled error during build:", error)
	process.exit(1)
})
