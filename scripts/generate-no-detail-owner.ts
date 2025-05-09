import * as fs from "node:fs"
import * as path from "node:path"
import pako from "pako"
import type {
	BuiltCollectionData,
	BuiltCollectionCompactData,
	DataGroupOwner
} from "../src/build.types"
import type {
	AllTournaments,
	TournamentsYears,
	TournamentsOfYear
} from "./indexing-tournaments"

/**
 * Minify JSON string by parsing and stringifying without pretty printing
 */
function minifyJson(json: string): string {
	try {
		const obj = JSON.parse(json)
		return JSON.stringify(obj)
	} catch {
		return json
	}
}

/**
 * Compress a file using gzip and save with .compressed extension
 * Returns compression statistics for reporting
 */
function compressJsonFile(filepath: string): {
	originalSize: number
	compressedSize: number
	savings: number
	percentage: number
} {
	// Read and minify the JSON content
	const content = fs.readFileSync(filepath, "utf8")
	const minifiedContent = minifyJson(content)

	// Compress using pako gzip
	const compressed = pako.gzip(minifiedContent)

	// Verify gzip header
	if (
		compressed.length < 2 ||
		compressed[0] !== 0x1f ||
		compressed[1] !== 0x8b
	) {
		throw new Error(
			"Compression failed: Invalid gzip header in compressed output"
		)
	}

	// Save the compressed file
	const compressedFilepath = `${filepath}.compressed`
	fs.writeFileSync(compressedFilepath, Buffer.from(compressed))

	// Calculate compression stats
	const originalSize = Buffer.byteLength(content)
	const compressedSize = compressed.length
	const savings = originalSize - compressedSize
	const percentage = Number(((savings / originalSize) * 100).toFixed(1))

	return { originalSize, compressedSize, savings, percentage }
}

/**
 * Convert BuiltCollectionData to BuiltCollectionCompactData
 */
function convertToCompactData(
	data: BuiltCollectionData
): BuiltCollectionCompactData {
	return {
		owner: data.owner,
		collections: data.collections,
		statistics: data.statistics,
		data: Object.fromEntries(
			Object.entries(data.data).map(([key, value]) => [
				key,
				{
					meta: value.meta
				}
			])
		)
	}
}

/**
 * Generate compact version of register.json files
 * Returns statistics for reporting
 */
function processRegisterFiles(): {
	processed: Array<{
		group: string
		stats: ReturnType<typeof compressJsonFile>
	}>
	errors: Array<{ group: string; error: Error }>
} {
	const groups: DataGroupOwner[] = [
		"end-games",
		"mid-games",
		"opening",
		"puzzles",
		"selected-games"
	]

	const results = {
		processed: [] as Array<{
			group: string
			stats: ReturnType<typeof compressJsonFile>
		}>,
		errors: [] as Array<{ group: string; error: Error }>
	}

	for (const group of groups) {
		try {
			const registerPath = path.resolve(
				__dirname,
				"..",
				"build",
				group,
				"register.json"
			)

			// Read and parse the original data
			const originalData = JSON.parse(
				fs.readFileSync(registerPath, "utf8")
			) as BuiltCollectionData

			// Convert to compact format
			const compactData = convertToCompactData(originalData)

			// Write compact data
			const compactPath = path.resolve(
				path.dirname(registerPath),
				"register.compact.json"
			)
			fs.writeFileSync(compactPath, JSON.stringify(compactData, null, 2))

			// Compress and get stats
			const stats = compressJsonFile(compactPath)
			results.processed.push({ group, stats })
		} catch (error) {
			results.errors.push({ group, error: error as Error })
		}
	}

	return results
}

/**
 * Process tournaments index and generate year-based files
 * Returns statistics for reporting
 */
function processTournaments(): {
	processed: string[]
	errors: string[]
} {
	const results = {
		processed: [] as string[],
		errors: [] as string[]
	}

	try {
		const tournamentsDir = path.resolve(__dirname, "..", "build", "tournaments")
		const indexPath = path.resolve(tournamentsDir, "index.json")

		// Read and parse the tournaments index
		const allTournaments = JSON.parse(
			fs.readFileSync(indexPath, "utf8")
		) as AllTournaments

		// Generate index.year.json
		const yearsData: TournamentsYears = {
			owner: "tournaments",
			statistics: allTournaments.statistics,
			data: allTournaments.data.map(([year]) => year)
		}

		const yearIndexPath = path.resolve(tournamentsDir, "index.year.json")
		fs.writeFileSync(yearIndexPath, JSON.stringify(yearsData, null, 2))
		results.processed.push("index.year.json")

		// Generate individual year files
		for (const [year, tournaments] of allTournaments.data) {
			const yearData: TournamentsOfYear = {
				[year]: tournaments
			}

			const yearPath = path.resolve(tournamentsDir, `index.${year}.json`)
			fs.writeFileSync(yearPath, JSON.stringify(yearData, null, 2))
			results.processed.push(`index.${year}.json`)
		}
	} catch (error) {
		results.errors.push(`Error processing tournaments: ${error}`)
	}

	return results
}

function formatBytes(bytes: number): string {
	return `${(bytes / 1024).toFixed(1)} KB`
}

// Main execution
try {
	console.log("Part 1: Processing register.json files...")
	const registerResults = processRegisterFiles()

	// Report register.json processing results
	console.log("\nRegister Files Processing Report:")
	console.log("=================================")

	for (const { group, stats } of registerResults.processed) {
		console.log(`\nGroup: ${group}`)
		console.log(`  Original size: ${formatBytes(stats.originalSize)}`)
		console.log(`  Compressed size: ${formatBytes(stats.compressedSize)}`)
		console.log(`  Saved: ${stats.percentage}%`)
	}

	if (registerResults.errors.length > 0) {
		console.log("\nErrors during register files processing:")
		for (const { group, error } of registerResults.errors) {
			console.error(`  ${group}: ${error.message}`)
		}
	}

	console.log("\nPart 2: Processing tournaments index...")
	const tournamentResults = processTournaments()

	// Report tournaments processing results
	console.log("\nTournaments Processing Report:")
	console.log("==============================")
	console.log("\nProcessed files:")
	for (const file of tournamentResults.processed) {
		console.log(`  ${file}`)
	}

	if (tournamentResults.errors.length > 0) {
		console.log("\nErrors during tournaments processing:")
		for (const error of tournamentResults.errors) {
			console.error(`  ${error}`)
		}
	}

	console.log("\nProcessing completed successfully!")
} catch (error) {
	console.error("Fatal error:", error)
	process.exit(1)
}
