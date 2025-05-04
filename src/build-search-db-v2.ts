import fs from "node:fs"
import path from "node:path"
import zlib from "node:zlib"
import { applyDataConversions, getMissingTranslations } from "./data-converter"

const DATA_DIR = path.resolve(process.cwd(), "data") // Base directory for groups/collections
const OUTPUT_DIR = path.resolve(process.cwd(), "search")

// Test mode configuration
const TEST_MODE = process.env.TEST_MODE === "true"
const TEST_FILE_LIMIT = 1000 // Number of files to process in test mode

/**
 * Represents a single Chinese Chess game record optimized for searching.
 */
export type SearchItem = {
	/** "id" Unique identifier for the game (e.g., "collectionName/filename"). Primary Key in IndexedDB. */
	i: string

	/** "collectionName" The name of the collection (folder) the game belongs to. Indexed. */
	c: string

	// --- Core Metadata (Likely Indexed & Searched) ---

	/** "title" Game title (from DhtmlXQ_title). */
	t: string
	/** "event" Event/Tournament name (from DhtmlXQ_event). Indexed. */
	e: string
	/** "dateStr" Original date string (from DhtmlXQ_date). */
	d: string
	/** "eventYear" Extracted year from dateStr (e.g., 2023 or null if invalid/missing). Indexed. */
	eY: number | null
	/** "place" Location of the game (from DhtmlXQ_place). */
	p: string
	/** "redPlayer" Red player's name (from DhtmlXQ_red). Indexed. */
	rP: string
	/** "blackPlayer" Black player's name (from DhtmlXQ_black). Indexed. */
	bP: string
	/** "openingName" Opening name/classification (from DhtmlXQ_open). Potentially Indexed. */
	oN: string
	/** "result" Game result string (from DhtmlXQ_result). */
	r: string

	// --- Additional Metadata (Searched, Less Likely Indexed) ---

	/** "round" Round information (from DhtmlXQ_round). */
	rd: string
	/** "redTeam" Red player's team (from DhtmlXQ_redteam). */
	rT: string
	/** "blackTeam" Black player's team (from DhtmlXQ_blackteam). */
	bT: string
	/** "gameType" Game type description (combined from DhtmlXQ_type, DhtmlXQ_gametype). */
	g: string

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
 * Handles multiline content and properly extracts all tags.
 */
function parseDhtmlXQ(
	dataSource: string,
	id: string,
	collectionName: string
): {
	id: string
	collectionName: string
	title: string
	event: string
	dateStr: string
	eventYear: number | null
	place: string
	redPlayer: string
	blackPlayer: string
	openingName: string
	result: string
	round: string
	redTeam: string
	blackTeam: string
	gameType: string
	remarks: string
	allTextContent: string
	movelist: string
	binit: string
	comments: Record<string, string>
} {
	// Create an object to store the parsed data
	const game = {
		id: id || "",
		collectionName: collectionName || "",
		title: "",
		event: "",
		dateStr: "",
		eventYear: 0,
		place: "",
		redPlayer: "",
		blackPlayer: "",
		openingName: "",
		result: "",
		round: "",
		redTeam: "",
		blackTeam: "",
		gameType: "",
		remarks: "",
		allTextContent: "",
		movelist: "",
		binit: "",
		comments: {} as Record<string, string>
	}

	// Regular expression to match DhtmlXQ tags - handles multiline content
	// This pattern also handles potential mismatches between opening and closing tags
	const tagPattern = /\[DhtmlXQ_([^\]]+)\]([\s\S]*?)\[\/DhtmlXQ_(?:[^\]]+)\]/g
	let match: RegExpExecArray | null = null

	// Extract all text content for search purposes
	const allTextContent: string[] = []

	// Process each matched tag
	match = tagPattern.exec(dataSource)
	while (match !== null) {
		const tagName = match[1].toLowerCase() // Normalize tag names to lowercase
		const content = match[2] || ""

		if (content.trim()) {
			// Skip adding empty content to allTextContent
			allTextContent.push(content)
		}

		// Map the tags to our game object
		switch (tagName) {
			case "title":
				game.title = content || ""
				break
			case "event":
				game.event = content || ""
				break
			case "date":
				game.dateStr = content
				if (content) {
					// Extract year from date if possible
					const yearMatch = content.match(/\d{4}/)
					if (yearMatch) {
						game.eventYear = Number.parseInt(yearMatch[0], 10)
					}
				}
				break
			case "place":
				game.place = content || ""
				break
			case "red":
				game.redPlayer = content || ""
				break
			case "black":
				game.blackPlayer = content || ""
				break
			case "result":
				game.result = content || ""
				break
			case "round":
				game.round = content || ""
				break
			case "redteam":
				game.redTeam = content || ""
				break
			case "blackteam":
				game.blackTeam = content || ""
				break
			case "type":
			case "gametype":
				game.gameType = content || ""
				break
			case "remark":
				game.remarks = content || ""
				break
			case "movelist":
				game.movelist = content || ""
				break
			case "binit":
				game.binit = content || ""
				break
			case "open":
				game.openingName = content || ""
				break
		}

		// Extract comments (numbered or with variations)
		if (tagName.startsWith("comment")) {
			// Store all comments including those with variations (like comment1_3)
			game.comments[tagName] = content
		}

		// Get the next match
		match = tagPattern.exec(dataSource)
	}

	// Combine all text content for search
	game.allTextContent = allTextContent.join(" ")

	return game
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

const ownerIdMapping = {
	community: "cong dong",
	"end-games": "tan cuc cuoc",
	"mid-games": "trung cuc cuoc",
	opening: "khai cuoc",
	puzzles: "bai luyen tap",
	"selected-games": "tuyen chon",
	tournaments: "giai thi dau"
}
type OwnerIdMapping = keyof typeof ownerIdMapping

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
			// Parse the DhtmlXQ data
			const parsedData = parseDhtmlXQ(fileContent, filename, collectionName)

			// Apply data conversions (date formatting, result translation, Han-Viet translations)
			const convertedData = applyDataConversions(parsedData)

			// Combine remarks and comments
			// let allText = convertedData.remarks || ""
			// if (convertedData.comments) {
			// 	for (const key of Object.keys(convertedData.comments)) {
			// 		allText = `${allText} ${convertedData.comments[key]}`
			// 	}
			// }

			const gameType = convertedData.gameType || ""

			const searchItem: SearchItem = {
				i: `${collectionName}/${filename}`, // Unique ID - keep template literal here as it needs interpolation
				c: collectionName,
				t: convertedData.title || "",
				e: convertedData.event || "",
				d: convertedData.dateStr || "",
				eY: convertedData.eventYear || null, // Use the year extracted in parseDhtmlXQ
				p: convertedData.place || "",
				rP: convertedData.redPlayer || "",
				bP: convertedData.blackPlayer || "",
				oN: convertedData.openingName || "",
				r: convertedData.result || "",
				rd: convertedData.round || "",
				rT: convertedData.redTeam || "",
				bT: convertedData.blackTeam || "",
				g: gameType,
				movelist: convertedData.movelist || "",
				// binit: parsedData.binit || undefined, // Optional
				/**
				 * Currently, we will not include text content
				 */
				allTextContent: [
					ownerIdMapping[groupName as OwnerIdMapping],
					collectionFolderName.replaceAll("-", " ")
				].join(" ")
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

	// Output missing translations for dictionary improvement
	const missingChars = getMissingTranslations()
	console.log("\nChecking for untranslated characters...")
	if (missingChars.length > 0) {
		console.log(
			`\nFound ${missingChars.length} untranslated characters: ${missingChars.join("")}`
		)

		// Write each untranslated character to a file, one per line
		const missingTranslationsPath = path.join(
			OUTPUT_DIR,
			"untranslated-characters.txt"
		)
		fs.writeFileSync(missingTranslationsPath, missingChars.join("\n"))
		console.log(
			`\nUntranslated characters saved to: ${missingTranslationsPath}`
		)
	} else {
		console.log(
			"\nGreat! No missing translations found. All characters were successfully translated."
		)
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
