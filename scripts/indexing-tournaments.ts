import * as fs from "node:fs"
import * as path from "node:path"
import pako from "pako"

type Year = string
type TournamentName = string

export type AllTournaments = {
	owner: "tournaments"
	statistics: { collections: number; games: number }
	data: Array<[Year, { name: TournamentName; fullname: string }[]]>
}

export type TournamentsYears = {
	owner: "tournaments"
	statistics: { collections: number; games: number }
	data: Array<Year>
}

export type TournamentsOfYear = Record<
	Year,
	{ name: TournamentName; fullname: string }[]
>

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
 * Handles various formats including:
 * - YYYY + tournament name
 * - YYYY- + tournament name
 * - YYYY年 + tournament name
 * - YYYY年- + tournament name
 * - YYYY-YYYY + tournament name
 * - YYYY年-YYYY + tournament name
 * - YYYY-X-Y + tournament name (date formats)
 * - YYYY年-X-Y + tournament name (date formats with 年)
 * - YYYY月日 + tournament name (Chinese date format)
 * - YYYY年-月日 + tournament name (Chinese date format with 年-)
 * - YYYY年-XX月 + tournament name (year with month only)
 * - YYYY年-XX日 + tournament name (year with day only)
 * - YYYY年-XX + tournament name (year with numeric month/day without 月/日 indicator)
 * - YYYY年-XX- + tournament name (year with numeric month/day with trailing dash)
 */
export function extractTournamentName(filename: string): string {
	console.log("Extracting tournament name from filename:", filename)
	// Remove the extension
	const withoutExtension = filename.replace(".register.json", "")

	// First, handle the specific case with year + month + day format (highest priority)
	// Examples: "2018年-03月18日太原市阳曲县"升龙杯"象棋赛" or "201803月18日太原市阳曲县"升龙杯"象棋赛"
	const yearMonthDayPattern = /^\d{4}(?:年-|年)?(\d{1,2})月(\d{1,2})日(.+)/
	const yearMonthDayMatch = withoutExtension.match(yearMonthDayPattern)
	if (yearMonthDayMatch?.[3]) {
		console.log(`Original: ${filename}`)
		console.log(`Extracted: ${yearMonthDayMatch[3]}`)
		return cleanupTournamentName(yearMonthDayMatch[3])
	}

	// Handle case with year + month only format (high priority) - e.g., "2012年-11月全国象棋甲级联赛"
	const yearMonthPattern = /^\d{4}(?:年-|年)?(\d{1,2})月(.+)/
	const yearMonthMatch = withoutExtension.match(yearMonthPattern)
	if (yearMonthMatch?.[2]) {
		console.log(`Original: ${filename}`)
		console.log(`Extracted: ${yearMonthMatch[2]}`)
		return cleanupTournamentName(yearMonthMatch[2])
	}

	// Handle case with year + day only format (high priority) - e.g., "2012年-11日全国象棋甲级联赛"
	const yearDayPattern = /^\d{4}(?:年-|年)?(\d{1,2})日(.+)/
	const yearDayMatch = withoutExtension.match(yearDayPattern)
	if (yearDayMatch?.[2]) {
		console.log(`Original: ${filename}`)
		console.log(`Extracted: ${yearDayMatch[2]}`)
		return cleanupTournamentName(yearDayMatch[2])
	}

	// Handle case with year + numeric value without 月/日 indicator - e.g., "1993年-09" or "1993年-09-"
	const yearNumericPattern = /^\d{4}(?:年-|年)?(\d{1,2})(?:-)?(.+)/
	const yearNumericMatch = withoutExtension.match(yearNumericPattern)
	if (yearNumericMatch?.[2]) {
		console.log(`Original: ${filename}`)
		console.log(`Extracted: ${yearNumericMatch[2]}`)
		return cleanupTournamentName(yearNumericMatch[2])
	}

	// Special case for year-ranges like "1998-12-199901第14届五羊杯电视快棋赛" or "1998年-12-199901第14届五羊杯电视快棋赛"
	// Handle year-date-year pattern more generically
	const yearRangePattern = /^\d{4}(?:年)?-\d+-\d+(.*)/
	const yearRangeMatch = withoutExtension.match(yearRangePattern)
	if (yearRangeMatch?.[1]) {
		return cleanupTournamentName(yearRangeMatch[1])
	}

	// Handle formats like "1998年-第14届五羊杯电视快棋赛"
	const yearWithSuffixPattern = /^\d{4}年-(.+)/
	const yearWithSuffixMatch = withoutExtension.match(yearWithSuffixPattern)
	if (yearWithSuffixMatch?.[1]) {
		return cleanupTournamentName(yearWithSuffixMatch[1])
	}

	// Handle year-to-year ranges like "YYYY-YYYY" or "YYYY年-YYYY" with variable digit count for the second year
	// (since X could be 1-4 digits)
	const yearToYearPattern = /^\d{4}(?:年)?-\d+(.*)/
	const yearToYearMatch = withoutExtension.match(yearToYearPattern)
	if (yearToYearMatch?.[1]) {
		// Make sure we're not matching something that should be handled by more specific patterns
		// Only accept if the matched part starts with non-digit or - followed by non-digit
		if (yearToYearMatch[1].match(/^(?:[^-\d]|(?:-[^-\d]))/)) {
			return cleanupTournamentName(yearToYearMatch[1])
		}
	}

	// Handle other date formats (like just month or just day)
	const datePattern =
		/^\d{4}(?:年-|年|\-)?(?:\d{1,4}月|\d{1,4}日|\-\d+|\-\d+\-\d+)(.*)/
	const dateMatch = withoutExtension.match(datePattern)
	if (dateMatch?.[1]) {
		return cleanupTournamentName(dateMatch[1])
	}

	// Handle case with just digits after year (like "1993年-09" or "1993年-09-")
	const yearDigitsPattern = /^\d{4}(?:年-|年|\-)?(\d{1,4})(?:-|\b)(.*)/
	const yearDigitsMatch = withoutExtension.match(yearDigitsPattern)
	if (yearDigitsMatch?.[2]) {
		return cleanupTournamentName(yearDigitsMatch[2])
	}

	// If no date component, try simpler year prefix patterns
	const yearPattern = /^\d{4}(?:年-|年|\-)?(.*)/
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
 * - Trim leading and trailing hyphens
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

	// Trim any leading and trailing spaces and hyphens
	cleanName = cleanName.trim()
	cleanName = cleanName.replace(/^-+/, "") // Remove leading hyphens
	cleanName = cleanName.replace(/-+$/, "") // Remove trailing hyphens
	return cleanName
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

	// Convert to array and sort by year (most recent first)
	const data = Array.from(tournamentsByYear.entries()).sort(
		([yearA], [yearB]) => yearB.localeCompare(yearA)
	)

	// Create the final result with statistics
	const result: AllTournaments = {
		owner: "tournaments",
		statistics: {
			collections: collectionsCount,
			games: totalGamesCount
		},
		data: data
	}

	return { allTournaments: result, unmatchedFiles }
}

function minifyJson(json: string): string {
	try {
		const obj = JSON.parse(json)
		return JSON.stringify(obj)
	} catch {
		return json
	}
}

/**
 * Compresses a JSON file using gzip and saves it with a .compressed extension
 * @param {string} filepath - The path to the JSON file to compress
 */
function compressJsonFile(filepath: string): void {
	try {
		// Read and minify the JSON content
		const content = fs.readFileSync(filepath, "utf8")
		const minifiedContent = minifyJson(content)

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
	// Test extraction with example filenames
	console.log("\nTesting extractTournamentName function with sample filenames:")
	const testCases = [
		"1998-12-199901第14届五羊杯电视快棋赛.register.json",
		"1998年-12-199901第14届五羊杯电视快棋赛.register.json",
		"1998第14届五羊杯电视快棋赛.register.json",
		"1998年-第14届五羊杯电视快棋赛.register.json",
		'201803月18日太原市阳曲县"升龙杯"象棋赛.register.json',
		'2018年-03月18日太原市阳曲县"升龙杯"象棋赛.register.json',
		"2012年-11月全国象棋甲级联赛.register.json",
		"2012年-11日全国象棋甲级联赛.register.json",
		"201211月全国象棋甲级联赛.register.json",
		"201211日全国象棋甲级联赛.register.json",
		"1993年-09全国象棋锦标赛.register.json",
		"1993年-09-全国象棋锦标赛.register.json",
		"199309全国象棋锦标赛.register.json",
		"199309-全国象棋锦标赛.register.json"
	]

	for (const testCase of testCases) {
		const result = extractTournamentName(testCase)
		console.log(`\nOriginal: ${testCase}`)
		console.log(`Extracted: ${result}`)
	}

	console.log("\nIndexing tournaments...")
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
