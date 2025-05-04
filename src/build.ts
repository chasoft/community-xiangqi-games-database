/*******************************************************************************
 *
 *     This script is used to build the project
 *     Don't touch this file unless you know what you are doing
 *     🩠 	🩡 	🩢 	🩣 	🩤 	🩥 	🩦 	🩧 	🩨 	 🩩 	🩪 	🩫 	🩬 	🩭
 *
 ******************************************************************************/

import { exec } from "node:child_process"
import fs from "node:fs/promises"
import path from "node:path"
import { createInterface } from "node:readline"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import chalk from "chalk"
import cliProgress from "cli-progress"
import Table from "cli-table3"
import equal from "fast-deep-equal"
import pako from "pako"
import type {
	BuiltCollectionData,
	CollectionData,
	CollectionDataFull,
	DataGroupOwner
} from "./build.types"
import { gameStartedFromTheBegining, getLastPiecesPosition } from "./game"
import { createHash } from "./utils"

// Determine project root directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, "..")

const welcomeMessage = `
  ╦  ╦╦╔═╗╔╦╗   ╔═╗╔═╗  ╔╦╗╦ ╦╔═╗╔╗╔╔═╗
  ╚╗╔╝║║╣  ║    ║  ║ ║   ║ ║ ║║ ║║║║║ ╦
   ╚╝ ╩╚═╝ ╩    ╚═╝╚═╝   ╩ ╚═╝╚═╝╝╚╝╚═╝
═════════════════════════════════════════
      vietcotuong.com - xiangqi db
═════════════════════════════════════════`

// Absolute paths for project directories
const source_path = path.join(PROJECT_ROOT, "data")
const build_path = path.join(PROJECT_ROOT, "build")
const temp_path = path.join(PROJECT_ROOT, "build.temp")

// Groups to be processed
const groups = [
	"end-games",
	"mid-games",
	"opening",
	"puzzles",
	"selected-games",
	"tournaments"
]

async function readJsonFile<T>(filepath: string): Promise<T> {
	try {
		const content = await fs.readFile(filepath, "utf-8")
		return JSON.parse(content) as T
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(
				`Failed to read/parse JSON file ${filepath}: ${error.message}`
			)
		}
		throw new Error(`Failed to read/parse JSON file ${filepath}: Unknown error`)
	}
}

async function readMarkdownSafely(filepath: string): Promise<string> {
	try {
		return await fs.readFile(filepath, "utf-8")
	} catch {
		return ""
	}
}

function validateCollectionData(data: CollectionData, filepath: string) {
	if (!data.meta?.title) throw new Error(`Missing meta.title in ${filepath}`)
	// if (!data.meta?.description)
	// 	throw new Error(`Missing meta.description in ${filepath}`)
	if (!data.meta?.updatedAt)
		throw new Error(`Missing meta.updatedAt in ${filepath}`)
	if (!data.details || typeof data.details !== "object") {
		throw new Error(`Invalid details structure in ${filepath}`)
	}
}

function formatDuration(ms: number): string {
	const seconds = (ms / 1000).toFixed(2)
	return `${seconds}s`
}

function formatBytes(bytes: number): string {
	return `${(bytes / 1024).toFixed(1)} KB`
}

type ComparableValue =
	| string
	| number
	| boolean
	| null
	| undefined
	| Record<string, unknown>
	| ComparableValue[]

function analyzeObjectDifferences(
	obj1: ComparableValue,
	obj2: ComparableValue,
	path: string[] = []
): string[] {
	const differences: string[] = []

	if (typeof obj1 !== typeof obj2) {
		differences.push(
			`Type mismatch at ${path.join(".")}: ${typeof obj1} vs ${typeof obj2}`
		)
		return differences
	}

	if (Array.isArray(obj1) && Array.isArray(obj2)) {
		if (obj1.length !== obj2.length) {
			differences.push(
				`Array length mismatch at ${path.join(".")}: ${obj1.length} vs ${obj2.length}`
			)
		}
		for (let i = 0; i < obj1.length; i++) {
			if (i < obj2.length) {
				differences.push(
					...analyzeObjectDifferences(obj1[i], obj2[i], [...path, i.toString()])
				)
			}
		}
		return differences
	}

	if (
		typeof obj1 === "object" &&
		obj1 !== null &&
		typeof obj2 === "object" &&
		obj2 !== null
	) {
		const keys1 = Object.keys(obj1).sort()
		const keys2 = Object.keys(obj2).sort()

		for (const key of keys1) {
			if (!Object.hasOwn(obj2, key)) {
				differences.push(
					`Key ${key} missing in second object at ${path.join(".")}`
				)
			} else {
				differences.push(
					...analyzeObjectDifferences(
						(obj1 as Record<string, ComparableValue>)[key],
						(obj2 as Record<string, ComparableValue>)[key],
						[...path, key]
					)
				)
			}
		}

		for (const key of keys2) {
			if (!Object.hasOwn(obj1, key)) {
				differences.push(
					`Key ${key} missing in first object at ${path.join(".")}`
				)
			}
		}

		return differences
	}

	if (obj1 !== obj2) {
		differences.push(`Value mismatch at ${path.join(".")}: ${obj1} vs ${obj2}`)
	}

	return differences
}

function minifyJson(json: string): string {
	try {
		const obj = JSON.parse(json)
		return JSON.stringify(obj)
	} catch {
		return json
	}
}

async function handleCollectionFile(
	groupName: string,
	collectionName: string,
	data: CollectionDataFull
): Promise<CompressionStats> {
	const targetPath = path.join(
		temp_path,
		groupName,
		`${collectionName}.register.json`
	)
	const existingPath = path.join(
		build_path,
		groupName,
		`${collectionName}.register.json`
	)

	// Calculate original and minified sizes
	const originalString = JSON.stringify(data, null, 2) // Pretty format for original
	const minifiedString = minifyJson(JSON.stringify(data))
	const originalSize = Buffer.byteLength(originalString)
	const minifiedSize = Buffer.byteLength(minifiedString)

	try {
		// Read existing file as raw string and compare strings directly
		const existingString = await fs.readFile(existingPath, "utf-8")
		if (existingString === minifiedString) {
			// Content identical after minification - copy existing file
			await fs.mkdir(path.dirname(targetPath), { recursive: true })
			await fs.copyFile(existingPath, targetPath)
			const minifiedSavings =
				((originalSize - minifiedSize) / originalSize) * 100

			return {
				originalSize,
				compressedSize: minifiedSize,
				minifiedSize,
				savings: 0,
				percentage: 0,
				minifiedSavings,
				unchanged: true
			}
		}

		// If we get here, the file content is different
		await fs.mkdir(path.dirname(targetPath), { recursive: true })
		await fs.writeFile(targetPath, minifiedString)

		const minifiedSavings = ((originalSize - minifiedSize) / originalSize) * 100

		return {
			originalSize,
			compressedSize: minifiedSize,
			minifiedSize,
			savings: 0,
			percentage: 0,
			minifiedSavings,
			unchanged: false,
			differences: [
				`Content changed: was ${formatBytes(existingString.length)} now ${formatBytes(minifiedString.length)}`
			]
		}
	} catch {
		// New file
		await fs.mkdir(path.dirname(targetPath), { recursive: true })
		await fs.writeFile(targetPath, minifiedString)

		const minifiedSavings = ((originalSize - minifiedSize) / originalSize) * 100

		return {
			originalSize,
			compressedSize: minifiedSize,
			minifiedSize,
			savings: 0,
			percentage: 0,
			minifiedSavings,
			unchanged: false
		}
	}
}

// Collection Processing Functions

// Modify processCollection to track individual file stats
async function processCollection(
	collectionPath: string,
	collectionName: string,
	groupName: string
): Promise<[string, BuiltCollectionData["data"][string], CompressionStats]> {
	const registerPath = path.join(collectionPath, "register.json")
	const readmePath = path.join(collectionPath, "README.md")

	let registerData: CollectionData
	let isNewRegister = false
	try {
		registerData = await readJsonFile<CollectionData>(registerPath)
	} catch {
		// Create new register.json if it doesn't exist
		isNewRegister = true
		registerData = {
			meta: {
				title: collectionName,
				description: collectionName,
				tags: [],
				updatedAt: new Date().toISOString().split("T")[0].replace(/-/g, "/")
			},
			details: {}
		}
	}

	// Get all files in the directory
	const files = await fs.readdir(collectionPath)
	const gameFiles = files.filter(
		(file) => file !== "register.json" && file !== "README.md"
	)
	let hasChanges = isNewRegister

	// Process each game file
	for (const filename of gameFiles) {
		if (!registerData.details[filename]) {
			hasChanges = true
			registerData.details[filename] = { preview: "", description: "" }
		}

		if (
			hasChanges ||
			!registerData.details[filename].description ||
			!registerData.details[filename].preview
		) {
			// Read and process file content
			const content = await fs.readFile(
				path.join(collectionPath, filename),
				"utf-8"
			)

			// Extract description from DhtmlXQ_title if not exists
			if (!registerData.details[filename].description) {
				const titleMatch = content.match(
					/\[DhtmlXQ_title\](.*?)\[\/DhtmlXQ_title\]/
				)
				if (titleMatch) {
					registerData.details[filename].description = titleMatch[1]
					hasChanges = true
				}
			}

			// Extract binit and determine preview if not exists
			if (!registerData.details[filename].preview) {
				const binitMatch = content.match(
					/\[DhtmlXQ_binit\](.*?)\[\/DhtmlXQ_binit\]/
				)
				if (binitMatch) {
					const binit = binitMatch[1]
					if (!gameStartedFromTheBegining(binit)) {
						registerData.details[filename].preview = binit
						hasChanges = true
					} else {
						// Get movelist and calculate last position
						const movelistMatch = content.match(
							/\[DhtmlXQ_movelist\](.*?)\[\/DhtmlXQ_movelist\]/
						)
						if (movelistMatch) {
							registerData.details[filename].preview = getLastPiecesPosition(
								movelistMatch[1]
							)
							hasChanges = true
						}
					}
				}
			}
		}
	}

	// Save register.json if there were changes
	if (hasChanges) {
		await fs.writeFile(
			registerPath,
			JSON.stringify(registerData, null, 2),
			"utf-8"
		)
	}

	validateCollectionData(registerData, registerPath)
	const readmeContent = await readMarkdownSafely(readmePath)

	// Get all filenames and sort them
	const filenames = Object.keys(registerData.details).sort()

	// Sort keys for deterministic output
	const sortedDetails = Object.fromEntries(
		filenames.map((filename) => [
			filename,
			{
				...registerData.details[filename],
				gamePreview: `${createHash(registerData.details[filename].preview)}.png`,
				tags: [...(registerData.meta.tags || [])].sort()
			}
		])
	)

	// Save individual collection file
	const collectionFullData: CollectionDataFull = {
		meta: {
			...registerData.meta,
			readme: readmeContent
		},
		details: sortedDetails
	}

	const fileStats = await handleCollectionFile(
		groupName,
		collectionName,
		collectionFullData
	)

	return [
		collectionName,
		{
			meta: {
				...registerData.meta
			},
			details: sortedDetails
		},
		fileStats
	]
}

// Group Processing Functions

const multibar = new cliProgress.MultiBar(
	{
		clearOnComplete: false,
		hideCursor: true,
		format: "{bar} {percentage}% | {value}/{total} | {status}"
	},
	cliProgress.Presets.shades_grey
)

// Update processGroup to return processing time separately
// Modify processGroup to track individual file stats
async function processGroup(
	groupName: DataGroupOwner
): Promise<[BuiltCollectionData, number, Record<string, CompressionStats>]> {
	const groupStartTime = Date.now()
	const groupPath = path.join(source_path, groupName)

	// Ensure deterministic collection order
	const collections = (await fs.readdir(groupPath)).sort()

	console.log(chalk.yellow(`\n📁 Group: ${groupName}`))
	const progressBar = multibar.create(collections.length, 0, {
		status: "\nStarting..."
	})
	let processedCount = 0
	let totalGames = 0
	const collectionStats: Record<string, CompressionStats> = {}

	const collectionsData = await Promise.all(
		collections.map(
			async (
				collection
			): Promise<
				[string, BuiltCollectionData["data"][string], CompressionStats] | null
			> => {
				const collectionPath = path.join(groupPath, collection)
				const stats = await fs.stat(collectionPath)
				if (!stats.isDirectory()) return null

				const result = await processCollection(
					collectionPath,
					collection,
					groupName
				)
				if (result) {
					const [name, _, fileStats] = result
					collectionStats[name] = fileStats
					const gamesCount = Object.keys(result[1].details).length
					totalGames += gamesCount
					progressBar.update(++processedCount, {
						status: `${collection} (${gamesCount} games)`
					})
				}
				return result
			}
		)
	)

	const validCollections = collectionsData
		.filter(
			(
				item
			): item is [
				string,
				BuiltCollectionData["data"][string],
				CompressionStats
			] => item !== null
		)
		.sort(([nameA], [nameB]) => nameA.localeCompare(nameB)) // Sort collections

	const data = Object.fromEntries(
		validCollections.map(([name, data]) => [name, data])
	)
	const statistics = {
		...Object.fromEntries(
			validCollections.map(([name]) => [
				name,
				Object.keys(data[name].details).length
			])
		),
		total: validCollections.reduce(
			(sum, [name]) => sum + Object.keys(data[name].details).length,
			0
		)
	}

	// Keep track of duration separately (only for console reporting)
	const groupDuration = Date.now() - groupStartTime
	console.log(
		chalk.dim(
			`   → Total: ${statistics.total} games in ${processedCount} collections (${formatDuration(groupDuration)})`
		)
	)

	return [
		{
			owner: groupName,
			collections: [...Object.keys(data)].sort(),
			statistics,
			data: Object.fromEntries(
				[...Object.entries(data)].sort(([a], [b]) => a.localeCompare(b))
			)
		},
		groupDuration,
		collectionStats
	]
}

// Compression and Reporting Functions

type CompressionStats = {
	originalSize: number
	compressedSize: number
	minifiedSize: number // Add this
	savings: number
	percentage: number
	minifiedSavings: number // Add this
	unchanged?: boolean
	differences?: string[]
}

async function compressAndSave(
	data: Record<string, unknown>,
	filepath: string
): Promise<CompressionStats> {
	// Calculate original and minified sizes
	const originalString = JSON.stringify(data, null, 2) // Pretty format
	const minifiedString = minifyJson(JSON.stringify(data))
	const originalSize = Buffer.byteLength(originalString)
	const minifiedSize = Buffer.byteLength(minifiedString)
	const minifiedSavings = ((originalSize - minifiedSize) / originalSize) * 100

	const tempFilePath = filepath.replace(".compressed", "")
	const existingFilePath = tempFilePath.replace("build.temp", "build")
	const existingCompressedPath = filepath.replace("build.temp", "build")

	try {
		await fs.access(existingFilePath)
		await fs.access(existingCompressedPath)

		const existingData = JSON.parse(
			await fs.readFile(existingFilePath, "utf-8")
		)
		if (equal(existingData, data)) {
			// Content is identical - copy existing files
			await fs.mkdir(path.dirname(filepath), { recursive: true })
			await fs.copyFile(existingCompressedPath, filepath)
			await fs.writeFile(tempFilePath, minifiedString)

			// Get stats from existing files
			const compressedContent = await fs.readFile(existingCompressedPath)
			const compressedSize = compressedContent.length
			const savings = originalSize - compressedSize
			const percentage = Number(((savings / originalSize) * 100).toFixed(1))

			return {
				originalSize,
				compressedSize,
				minifiedSize,
				savings,
				percentage,
				minifiedSavings,
				unchanged: true
			}
		}

		const differences = analyzeObjectDifferences(
			existingData as ComparableValue,
			data as ComparableValue
		)

		const compressed = pako.gzip(minifiedString)

		// Verify gzip header immediately after compression
		if (
			compressed.length < 2 ||
			compressed[0] !== 0x1f ||
			compressed[1] !== 0x8b
		) {
			throw new Error(
				"Compression failed: Invalid gzip header in compressed output"
			)
		}

		const compressedSize = compressed.length
		const savings = originalSize - compressedSize
		const percentage = Number(((savings / originalSize) * 100).toFixed(1))

		await fs.mkdir(path.dirname(filepath), { recursive: true })
		await fs.writeFile(filepath, Buffer.from(compressed))
		await fs.writeFile(tempFilePath, minifiedString)

		return {
			originalSize,
			compressedSize,
			minifiedSize,
			savings,
			percentage,
			minifiedSavings,
			unchanged: false,
			differences
		}
	} catch (error) {
		// Log comparison errors for debugging
		console.debug("File comparison failed:", error)

		// Compress new content
		const compressed = pako.gzip(minifiedString) // Use minified string for compression
		const compressedSize = compressed.length
		const savings = originalSize - compressedSize
		const percentage = Number(((savings / originalSize) * 100).toFixed(1))

		await fs.mkdir(path.dirname(filepath), { recursive: true })
		await fs.writeFile(filepath, Buffer.from(compressed))
		await fs.writeFile(tempFilePath, minifiedString)

		return {
			originalSize,
			compressedSize,
			minifiedSize,
			savings,
			percentage,
			minifiedSavings,
			unchanged: false
		}
	}
}

// Modify createStatsTable to include individual file stats
function createStatsTable(
	groupsData: Record<string, BuiltCollectionData>,
	compressionStats: Record<string, CompressionStats>,
	collectionStats: Record<string, Record<string, CompressionStats>>,
	processingTimes: Record<string, number>
): string {
	// First table for compressed group files
	const compressedTable = new Table({
		head: [
			"Group",
			"Collections",
			"Games",
			"Original",
			"Compressed",
			"Saved",
			"Time"
		],
		style: { head: ["dim"], border: ["dim"] },
		chars: {
			top: "─",
			"top-mid": "┬",
			"top-left": "┌",
			"top-right": "┐",
			bottom: "─",
			"bottom-mid": "┴",
			"bottom-left": "└",
			"bottom-right": "┘",
			left: "│",
			"left-mid": "├",
			mid: "─",
			"mid-mid": "┼",
			right: "│",
			"right-mid": "┤",
			middle: "│"
		}
	})

	let totalCollections = 0
	let totalGames = 0
	let totalOriginalSize = 0
	let totalCompressedSize = 0

	for (const group of groups) {
		const data = groupsData[group]
		const stats = data.statistics
		const compression = compressionStats[group]
		if (!compression) {
			throw new Error(`Compression stats are missing for group ${group}`)
		}

		totalCollections += data.collections.length
		totalGames += stats.total

		// Only count sizes for changed files
		if (!compression.unchanged) {
			totalOriginalSize += compression.originalSize
			totalCompressedSize += compression.compressedSize
		}

		// Show dashes for unchanged files instead of sizes
		const rowData = [
			group,
			data.collections.length.toString(),
			stats.total.toString(),
			compression.unchanged ? "-" : formatBytes(compression.originalSize),
			compression.unchanged ? "-" : formatBytes(compression.compressedSize),
			compression.unchanged ? "unchanged" : `${compression.percentage}%`,
			formatDuration(processingTimes[group])
		]

		// Highlight rows with > 50% compression savings
		if (compression.unchanged) {
			rowData.forEach((value, index) => {
				rowData[index] = chalk.blue(value) // Blue for unchanged
			})
		} else if (compression.percentage > 50) {
			rowData.forEach((value, index) => {
				rowData[index] = chalk.green(value) // Green for good compression
			})
		}

		compressedTable.push(rowData)

		if (compression.differences?.length) {
			console.log(chalk.yellow(`\nDifferences in ${group}:`))
			for (const diff of compression.differences) {
				console.log(chalk.dim(`  → ${diff}`))
			}
		}
	}

	// Only calculate savings percentage if there were changes
	const totalSavings =
		totalOriginalSize === 0
			? 0
			: ((totalOriginalSize - totalCompressedSize) / totalOriginalSize) * 100

	compressedTable.push([
		chalk.bold("Total"),
		chalk.bold(totalCollections.toString()),
		chalk.bold(totalGames.toString()),
		chalk.bold(formatBytes(totalOriginalSize)),
		chalk.bold(formatBytes(totalCompressedSize)),
		chalk.bold(`${totalSavings}%`),
		chalk.bold("")
	])

	// Second table for uncompressed collection files
	const collectionTable = new Table({
		head: [
			"Group",
			"Collection",
			"Original",
			"Minified",
			"Saved",
			"Status",
			"Changes"
		],
		style: { head: ["dim"], border: ["dim"] },
		chars: {
			top: "─",
			"top-mid": "┬",
			"top-left": "┌",
			"top-right": "┐",
			bottom: "─",
			"bottom-mid": "┴",
			"bottom-left": "└",
			"bottom-right": "┘",
			left: "│",
			"left-mid": "├",
			mid: "─",
			"mid-mid": "┼",
			right: "│",
			"right-mid": "┤",
			middle: "│"
		}
	})

	let totalCollectionFiles = 0
	let changedCollectionFiles = 0

	for (const group of groups) {
		const stats = collectionStats[group]
		if (!stats) continue

		for (const [name, stat] of Object.entries(stats)) {
			totalCollectionFiles++
			if (!stat.unchanged) changedCollectionFiles++

			const rowData = [
				group,
				name,
				formatBytes(stat.originalSize),
				formatBytes(stat.minifiedSize),
				`${stat.minifiedSavings.toFixed(1)}%`,
				stat.unchanged ? "unchanged" : "modified",
				stat.differences?.length ? stat.differences.length.toString() : "-"
			]

			// Color coding
			if (stat.unchanged) {
				rowData.forEach((value, index) => {
					rowData[index] = chalk.blue(value)
				})
			} else {
				rowData.forEach((value, index) => {
					rowData[index] = chalk.yellow(value)
				})
			}

			collectionTable.push(rowData)
		}
	}

	// Add collection files summary row
	collectionTable.push([
		chalk.bold("Total"),
		chalk.bold(`${totalCollectionFiles}`),
		"",
		chalk.bold(`${changedCollectionFiles} changed`),
		""
	])

	let output = chalk.bold("\nCompressed Group Files:\n")
	output += compressedTable.toString()

	output += chalk.bold("\n\nUncompressed Collection Files:\n")
	output += collectionTable.toString()

	// Add detailed changes if any
	for (const group of groups) {
		const stats = collectionStats[group]
		if (!stats) continue

		const changes = Object.entries(stats).filter(
			([_, stat]) => !stat.unchanged && stat.differences?.length
		)
		if (changes.length > 0) {
			output += chalk.bold(`\n\nDetailed Changes in ${group}:\n`)
			for (const [name, stat] of changes) {
				output += chalk.yellow(`\n${name}:\n`)
				for (const diff of stat.differences || []) {
					output += chalk.dim(`  → ${diff}\n`)
				}
			}
		}
	}

	return output
}

// Main Build Process

const execAsync = promisify(exec)

async function gitCommitAndPush(message: string) {
	try {
		await execAsync("git add .")
		console.log(chalk.dim("Added changes to git staging..."))

		await execAsync(`git commit -m "${message}"`)
		console.log(chalk.dim("Committed changes..."))

		await execAsync("git push")
		console.log(chalk.green("✨ Successfully pushed to repository!"))
	} catch (error) {
		console.error(chalk.red("Failed to push changes:"), error)
		throw error
	}
}

async function promptCommitMessage(): Promise<string> {
	console.log(
		chalk.cyan("\n════════════════════════════════════════════════════════")
	)
	console.log(chalk.cyan("                 Git Operations"))
	console.log(
		chalk.cyan("════════════════════════════════════════════════════════")
	)
	console.log(chalk.dim("\nThe build process has completed successfully!"))
	console.log(
		chalk.dim("You can now commit and push your changes to the repository.")
	)
	console.log(chalk.dim("\nWhat will happen:"))
	console.log(chalk.dim(" 1. Add all changes (git add .)"))
	console.log(
		chalk.dim(' 2. Commit with your message (git commit -m "your message")')
	)
	console.log(chalk.dim(" 3. Push to remote repository (git push)"))
	console.log(
		chalk.yellow("\nNote: Press Enter without a message to skip Git operations")
	)

	const rl = createInterface({
		input: process.stdin,
		output: process.stdout
	})

	return new Promise((resolve) => {
		rl.question(chalk.green("\n📝 Enter commit message: "), (message) => {
			rl.close()
			resolve(message)
		})
	})
}

function hasChanges(
	compressionStats: Record<string, CompressionStats>,
	collectionStats: Record<string, Record<string, CompressionStats>>
): boolean {
	// Check group files
	if (Object.values(compressionStats).some((stat) => !stat.unchanged)) {
		return true
	}
	// Check collection files
	return Object.values(collectionStats).some((groupStats) =>
		Object.values(groupStats).some((stat) => !stat.unchanged)
	)
}

async function build() {
	const startTime = Date.now()
	// Clear console and output welcome message
	console.clear()
	console.log(chalk.blue(welcomeMessage))
	console.log(
		chalk.yellow("\nDiscover the world of Xiangqi with vietcotuong.com")
	)
	console.log(chalk.green("Built with ❤️  by the community, for the community"))
	console.log(chalk.dim("Building community xiangqi games database...\n"))
	console.log(chalk.bold.blue("🔨 Starting build process...\n"))

	try {
		const processStartTime = Date.now() // Start processing timer
		await fs.rm(temp_path, { recursive: true, force: true })
		await fs.mkdir(temp_path, { recursive: true })

		const mainProgress = multibar.create(groups.length, 0, {
			status: "Starting..."
		})
		let totalCollections = 0
		let totalGames = 0
		const groupsData: Record<string, BuiltCollectionData> = {}
		const compressionStats: Record<string, CompressionStats> = {} // New separate object
		const collectionStats: Record<string, Record<string, CompressionStats>> = {} // Add this to track individual file stats
		const processingTimes: Record<string, number> = {} // Add this to track times
		let totalOriginalSize = 0
		let totalCompressedSize = 0

		// Process each defined group
		for (let i = 0; i < groups.length; i++) {
			const group = groups[i]
			mainProgress.update(i, { status: `Processing ${group}...` })

			const [groupData, duration, fileStats] = await processGroup(
				group as DataGroupOwner
			)
			groupsData[group] = groupData
			processingTimes[group] = duration // Store duration separately
			collectionStats[group] = fileStats // Store individual file stats
			totalCollections += groupData.collections.length
			totalGames += groupData.statistics.total

			const groupBuildPath = path.join(temp_path, group)
			await fs.mkdir(groupBuildPath, { recursive: true })
			const stats = await compressAndSave(
				groupData,
				path.join(groupBuildPath, "register.json.compressed")
			)
			compressionStats[group] = stats // Store in separate object
			totalOriginalSize += stats.originalSize
			totalCompressedSize += stats.compressedSize
		}

		mainProgress.update(groups.length, { status: "Finalizing..." })
		await fs.rm(build_path, { recursive: true, force: true })
		await fs.rename(temp_path, build_path)

		multibar.stop()
		const processDuration = Date.now() - processStartTime
		const totalDuration = Date.now() - startTime
		console.log(chalk.bold.green("\n✨ Build completed successfully!"))
		console.log(chalk.dim(`Build Duration: ${formatDuration(totalDuration)}`))
		console.log(
			chalk.dim(`Processing Duration: ${formatDuration(processDuration)}\n`)
		)
		console.log(
			createStatsTable(
				groupsData,
				compressionStats,
				collectionStats,
				processingTimes
			)
		)
		console.log() // Empty line for formatting

		// Check if there were any changes
		if (!hasChanges(compressionStats, collectionStats)) {
			console.log(
				chalk.cyan("\n════════════════════════════════════════════════════════")
			)
			console.log(chalk.cyan("                 Build Status"))
			console.log(
				chalk.cyan("════════════════════════════════════════════════════════")
			)
			console.log(
				chalk.blue(
					"\n✨ Build completed successfully with no changes detected."
				)
			)
			console.log(
				chalk.dim("All files are up to date. No git operations required.")
			)
			console.log(chalk.green("\nThank you for using the build tool! 👋"))
			return
		}

		// Add Git operations after successful build
		const commitMessage = await promptCommitMessage()
		if (commitMessage.trim()) {
			await gitCommitAndPush(commitMessage)
			console.log(chalk.green("\n✨ All operations completed successfully!"))
		} else {
			console.log(chalk.yellow("\nSkipping Git operations..."))
			console.log(chalk.green("Thank you for using the build tool! 👋"))
		}
	} catch (error) {
		multibar.stop()
		console.log(chalk.bold.red("\n❌ Build failed:"))
		if (error instanceof Error) {
			console.error(chalk.red("Error:"), chalk.yellow(error.message))
			console.error(chalk.dim(error.stack))
		} else {
			console.error(chalk.red("Unknown error:"), error)
		}
		process.exit(1)
	}
}

build()
