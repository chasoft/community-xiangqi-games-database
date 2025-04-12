import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

/**
 * Extract the tournament name from a title string
 * @param {string} title - The title to extract tournament name from
 * @return {string} The extracted tournament name
 */
function extractTournamentName(title) {
	// First handle the case where the title might be a filename with extension
	const withoutExtension = title.replace(".register.json", "")

	// Special case for year-ranges like "1998-12-199901第14届五羊杯电视快棋赛"
	const yearRangePattern = /^\d{4}-\d+-\d+(.*)/
	const yearRangeMatch = withoutExtension.match(yearRangePattern)
	if (yearRangeMatch?.[1]) {
		return cleanupTournamentName(yearRangeMatch[1])
	}

	// Handle year-to-year ranges like "YYYY-YYYY" with variable digit count
	const yearToYearPattern = /^\d{4}-\d+(.*)/
	const yearToYearMatch = withoutExtension.match(yearToYearPattern)
	if (yearToYearMatch?.[1]) {
		// Only accept if the matched part starts with non-digit or - followed by non-digit
		if (yearToYearMatch[1].match(/^(?:[^-\d]|(?:-[^-\d]))/)) {
			return cleanupTournamentName(yearToYearMatch[1])
		}
	}

	// Try to match year + date format with month/day components
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

	// If none of the patterns matched, just remove years and parentheses
	return cleanupTournamentName(
		title.replace(/\(\d{4}[^\)]*\)|\d{4}[年]?/g, "").trim()
	)
}

/**
 * Additional cleanup for tournament names
 * @param {string} name - The name to clean up
 * @return {string} The cleaned up name
 */
function cleanupTournamentName(name) {
	// Replace commas with hyphens
	const cleanName = name.replace(/，/g, "-")
	// Trim whitespace
	return cleanName.trim()
}

/**
 * Normalize a tournament name by applying character replacements and removing suffixes
 * @param {string} name - The tournament name to normalize
 * @return {string} The normalized tournament name
 */
function normalizeName(name) {
	// Characters to replace and their replacements
	const replacements = {
		"（": "(",
		"）": ")",
		" ": "-",
		"，": "-"
	}

	let normalizedName = name

	// Apply character replacements
	for (const [oldChar, newChar] of Object.entries(replacements)) {
		normalizedName = normalizedName.replace(new RegExp(oldChar, "g"), newChar)
	}

	// Remove specific suffixes and normalize
	normalizedName = normalizedName
		.trim()
		// Remove any trailing dashes, regardless of what comes before
		.replace(/-+$/, "")
		// Remove ".CBL" suffix
		.replace(/\.CBL$/i, "")
		// Remove "CBL" suffix
		.replace(/CBL$/i, "")
		// Remove "(X).CBL" suffix where X is any number
		.replace(/\(\d+\)\.CBL$/i, "")
		// Remove "XQF" suffix
		.replace(/XQF$/i, "")
		// Remove "-XQF" suffix
		.replace(/-XQF$/i, "")
		// Remove "XQF格式" suffix
		.replace(/XQF格式$/i, "")
		// Remove "XQf格式" suffix (case variation)
		.replace(/XQf格式$/i, "")
		// Remove "-XQf格式" suffix
		.replace(/-XQf格式$/i, "")
		.replace(/-XQF格式$/i, "")
		// Remove "(X)" suffix where X is any number
		.replace(/\(\d+\)$/, "")
		// Remove trailing symbols if any
		.replace(/[\s\-\:\_\.\,]+$/, "")
		// Remove any trailing spaces that might remain after suffix removal
		.trim()

	return normalizedName
}

/**
 * Update all tournament register.json files in the build folder
 */

// Get all .register.json files in the build/tournaments directory
const tournamentsDir = join(__dirname, "../build/tournaments")

function processRegisterFiles(dir) {
	try {
		const files = readdirSync(dir)

		for (const file of files) {
			const filePath = join(dir, file)
			const stat = statSync(filePath)

			if (stat.isDirectory()) {
				// Recursively process subdirectories
				processRegisterFiles(filePath)
			} else if (file.endsWith(".register.json") && file !== "register.json") {
				// Process each .register.json file (except register.json itself)
				try {
					const data = JSON.parse(readFileSync(filePath, "utf8"))

					if (data.meta?.title) {
						// Extract and normalize the tournament name
						const tournamentName = extractTournamentName(data.meta.title)
						const normalizedName = normalizeName(tournamentName)

						// Update the title
						data.meta.title = normalizedName

						// Write the updated data back to the file
						writeFileSync(filePath, JSON.stringify(data), "utf8")
						console.log(`Updated: ${filePath}`)
					}
				} catch (fileErr) {
					console.error(`Error processing ${filePath}: ${fileErr.message}`)
				}
			}
		}
	} catch (err) {
		console.error(`Error reading directory ${dir}: ${err.message}`)
	}
}

// Start processing files
console.log("Starting to update tournament titles...")
processRegisterFiles(tournamentsDir)
console.log("Tournament title normalization completed.")
