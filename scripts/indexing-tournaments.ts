import * as fs from "node:fs"
import * as path from "node:path"
import pako from "pako"

type Year = string
type TournamentName = string
type AllTournaments = {
	statistics: { collections: number; games: number }
	data: Array<[Year, { name: TournamentName; fullname: string }[]]>
}

const tournamentsDir = path.resolve(__dirname, "../build/tournaments")
const outputFile = path.resolve(tournamentsDir, "index.json")

/**
 * Extracts the year from a tournament filename.
 * Handles various formats including:
 * - YYYY + tournament name + ".register.json"
 * - YYYY- + tournament name + ".register.json"
 * - YYYY-X + tournament name + ".register.json"
 * - YYYY-X- + tournament name + ".register.json"
 * - YYYY-X-X + tournament name + ".register.json"
 * - YYYY-X-X- + tournament name + ".register.json"
 * - YYYY年 + tournament name + ".register.json"
 * - YYYY年- + tournament name + ".register.json"
 * - YYYY年X月X日 + tournament name + ".register.json"
 * - YYYY年X月X日- + tournament name + ".register.json"
 */
function extractYearFromFilename(filename: string): string {
	// Match any of the patterns that start with 4 digits
	const yearMatch = filename.match(/^(\d{4})/)
	if (yearMatch) {
		return yearMatch[1]
	}
	return ""
}

/**
 * Extracts the tournament name from a filename.
 * Removes the year prefix, date information, and the ".register.json" extension.
 */
function extractTournamentName(filename: string): string {
	// Remove the extension
	const withoutExtension = filename.replace(".register.json", "")

	// Special case for year-ranges like "1998-12-199901第14届五羊杯电视快棋赛"
	// Handle year-date-year pattern more generically
	const yearRangePattern = /^\d{4}-\d+-\d+(.*)/
	const yearRangeMatch = withoutExtension.match(yearRangePattern)
	if (yearRangeMatch?.[1]) {
		return cleanupTournamentName(yearRangeMatch[1])
	}

	// Handle year-to-year ranges like "YYYY-YYYY" with variable digit count for the second year
	// (since X could be 1-4 digits)
	const yearToYearPattern = /^\d{4}-\d+(.*)/
	const yearToYearMatch = withoutExtension.match(yearToYearPattern)
	if (yearToYearMatch?.[1]) {
		// Make sure we're not matching something that should be handled by more specific patterns
		// Only accept if the matched part starts with non-digit or - followed by non-digit
		if (yearToYearMatch[1].match(/^(?:[^-\d]|(?:-[^-\d]))/)) {
			return cleanupTournamentName(yearToYearMatch[1])
		}
	}

	// More specific pattern to extract just the tournament name:
	// Match YYYY year patterns followed by optional date information
	// Handling X as variable length (1-4 digits)

	// First try to match year + date format with month/day components
	const datePattern =
		/^\d{4}(?:年|\-)?(?:\d{1,4}月\d{1,4}日|\d{1,4}月|\d{1,4}日|\-\d+|\-\d+\-\d+)(.*)/
	const dateMatch = withoutExtension.match(datePattern)
	if (dateMatch?.[1]) {
		return cleanupTournamentName(dateMatch[1])
	}

	// If no date component, try simpler year prefix patterns
	const yearPattern = /^\d{4}(?:年|\-)?(.*)/
	const yearMatch = withoutExtension.match(yearPattern)
	if (yearMatch?.[1]) {
		return cleanupTournamentName(yearMatch[1])
	}

	// If none of the patterns matched, return the filename without extension
	return cleanupTournamentName(withoutExtension)
}

/**
 * Additional cleanup for tournament names:
 * - Replace Chinese commas with hyphens
 * - Remove various types of game count suffixes
 * - Trim trailing hyphens
 */
function cleanupTournamentName(name: string): string {
	// Replace commas with hyphens
	let cleanName = name.replace(/，/g, "-")

	// Remove various types of game count suffixes
	cleanName = cleanName.replace(/\(\d+年\d+局\)$/, "") // (X年X局)
	cleanName = cleanName.replace(/\(\d+局\)$/, "") // (X局)
	cleanName = cleanName.replace(/\(\d+局全\)$/, "") // (X局全)
	cleanName = cleanName.replace(/\(全\d+局\)$/, "") // (全X局)
	cleanName = cleanName.replace(/\(全\d+局缺\d+局\)$/, "") // (全X局缺X局)
	cleanName = cleanName.replace(/\d+局$/, "") // X局

	// Trim any trailing spaces and hyphens
	return cleanName.trim().replace(/-+$/, "")
}

/**
 * Processes all tournament files and generates an index organized by year.
 * Returns the indexed tournaments and any files that didn't match expected patterns.
 */
function indexTournaments(): {
	allTournaments: AllTournaments
	unmatchedFiles: string[]
} {
	// Get all tournament files
	const files = fs
		.readdirSync(tournamentsDir)
		.filter(
			(file) =>
				file.endsWith(".register.json") &&
				!["register.json", "register.json.compressed", "index.json"].includes(
					file
				)
		)

	// Group tournaments by year
	const tournamentsByYear: Map<
		Year,
		{ name: TournamentName; fullname: string }[]
	> = new Map()
	const unmatchedFiles: string[] = []

	// Initialize statistics
	let totalGamesCount = 0
	let collectionsCount = 0

	for (const file of files) {
		const year = extractYearFromFilename(file)
		const tournamentName = extractTournamentName(file)

		if (year && tournamentName) {
			if (!tournamentsByYear.has(year)) {
				tournamentsByYear.set(year, [])
			}
			// Store both the tournament name and full filename (without extension)
			tournamentsByYear.get(year)?.push({
				name: tournamentName,
				fullname: file.replace(".register.json", "")
			})

			// Count this as a tournament collection
			collectionsCount++

			// Read the register.json file to count games
			try {
				const filePath = path.join(tournamentsDir, file)
				const tournamentData = JSON.parse(fs.readFileSync(filePath, "utf8"))
				if (tournamentData?.details) {
					// Count the number of game entries in the details object
					const gamesCount = Object.keys(tournamentData.details).length
					totalGamesCount += gamesCount
				}
			} catch (error) {
				console.error(`Error reading tournament file ${file}:`, error)
			}
		} else {
			// This file didn't match our expected patterns
			unmatchedFiles.push(file)
		}
	}

	// Sort tournament names within each year
	for (const [year, tournaments] of tournamentsByYear) {
		tournamentsByYear.set(year, tournaments.sort())
	}

	// Convert to array and sort by year
	const data = Array.from(tournamentsByYear.entries()).sort(
		([yearA], [yearB]) => yearA.localeCompare(yearB)
	)

	// Create the final result with statistics
	const result: AllTournaments = {
		statistics: {
			collections: collectionsCount,
			games: totalGamesCount
		},
		data: data
	}

	return { allTournaments: result, unmatchedFiles }
}

/**
 * Compresses a JSON file using gzip and saves it with a .compressed extension
 * @param {string} filepath - The path to the JSON file to compress
 */
function compressJsonFile(filepath: string): void {
	try {
		// Read and minify the JSON content
		const content = fs.readFileSync(filepath, "utf8")
		const minifiedContent = JSON.stringify(JSON.parse(content))

		// Compress using pako gzip (same as in build.ts)
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

		console.log(`Compressed ${filepath}:`)
		console.log(`  Original size: ${(originalSize / 1024).toFixed(1)} KB`)
		console.log(`  Compressed size: ${(compressedSize / 1024).toFixed(1)} KB`)
		console.log(`  Saved: ${percentage}%`)
	} catch (error) {
		console.error(`Error compressing ${filepath}:`, error)
		throw error
	}
}

// Main execution
try {
	console.log("Indexing tournaments...")
	const { allTournaments, unmatchedFiles } = indexTournaments()

	// Write the result to the output file
	fs.writeFileSync(outputFile, JSON.stringify(allTournaments, null, 2), "utf8")
	console.log(
		`Successfully indexed tournaments. Output written to ${outputFile}`
	)

	// Compress the generated JSON file
	console.log("\nCompressing index.json file...")
	compressJsonFile(outputFile)

	// Report any unmatched files
	if (unmatchedFiles.length > 0) {
		console.log(
			`\nWARNING: Found ${unmatchedFiles.length} files that don't match expected patterns:`
		)
		for (const file of unmatchedFiles) {
			console.log(` - ${file}`)
		}
	} else {
		console.log("\nAll files successfully matched expected patterns.")
	}
} catch (error) {
	console.error("Error indexing tournaments:", error)
	process.exit(1)
}
