import fs from "node:fs"
import path from "node:path"

// Root directory to start the scan
const rootDir = path.join(process.cwd(), "data")
let renamedFilesCount = 0
let renamedFoldersCount = 0
let skippedCount = 0

// Pattern replacements
const replacements = [
	{ from: "（", to: "(" },
	{ from: "）", to: ")" },
	{ from: "--", to: "-" },
	{ from: "-－-", to: "-" },
	{ from: "．", to: "-" },
	{ from: "，", to: "-" },
	{ from: "？", to: "" },
	{ from: "??", to: "?" },
	{ from: "()", to: "-" },
	{ from: " ", to: "-" }, // Replace spaces with dashes
	// Convert fullwidth square brackets to regular ones and add dashes
	{ from: "［", to: "[" },
	{ from: "］", to: "]" },
	{ from: "：", to: "-" },
	{ from: "【", to: "[" },
	{ from: "】", to: "]" },
	{ from: "、", to: "-" },
	{ from: "　", to: "-" },
	// Remove dashes in "第-{number}-局" pattern
	{ from: /第-(\d+)-局/g, to: "第$1局" },
	// Add leading zero for single-digit numbers in "第X局" pattern
	{ from: /第(\d)局/g, to: "第0$1局" },
	// Replace ending "-(single digit)" with "-0digit"
	{ from: /-\((\d)\)$/g, to: "-0$1" },
	// Replace ending "-(digits)" with "-digits"
	{ from: /-\((\d+)\)$/g, to: "-$1" },
	// Replace standalone "(digit)" with "-0digit-"
	{ from: /\((\d)\)/g, to: "-0$1-" },
	// Replace standalone "(digits)" with "-digits-"
	{ from: /\((\d+)\)/g, to: "-$1-" },
	// Add a dash between name and opening parenthesis
	{ from: /([^\s-])\(/g, to: "$1-(" },
	// Add a dash between closing square bracket and following text
	{ from: /\]([^\s-])/g, to: "]-$1" },
	// Add a dash between text and opening square bracket
	{ from: /([^\s-])\[/g, to: "$1-[" },
	// Format filenames/folders that start with a single digit and period
	{ from: /^(\d)\./, to: "0$1-" },
	// Format filenames/folders that start with multiple digits and period
	{ from: /^(\d\d+)\./, to: "$1-" },
	// Add dash between digits and text at the beginning of filename/foldername
	{ from: /^(\d+)([^\d-])/, to: "$1-$2" },
	// Remove dash between digits and 年 (year) at the beginning of filename/foldername
	{ from: /^(\d+)-年/, to: "$1年" },
	// Add dash after digits+年 (year) pattern at the beginning of filename/foldername
	{ from: /^(\d+年)([^-])/, to: "$1-$2" },
	// Convert "xxxx-第" to "xxxx年-第" for 4-digit years at the beginning
	{ from: /^(\d{4})-第/, to: "$1年-第" },
	// Remove "年" from years starting with zeros
	{ from: /^(0\d{3})年/, to: "$1" },
	{ from: /^(00\d{2})年/, to: "$1" },
	{ from: /^(000\d)年/, to: "$1" }
]

// Fullwidth number to regular number mapping
const fullwidthDigits: Record<string, string> = {
	"０": "0",
	"１": "1",
	"２": "2",
	"３": "3",
	"４": "4",
	"５": "5",
	"６": "6",
	"７": "7",
	"８": "8",
	"９": "9"
}

// Function to clean up a name
function cleanupName(name: string): string {
	let newName = name

	// First apply the general replacements
	for (const replacement of replacements) {
		if (replacement.from instanceof RegExp) {
			// If it's already a RegExp, use it directly
			newName = newName.replace(replacement.from, replacement.to)
		} else {
			// For string patterns, we need to escape special regex characters
			const escapedPattern = replacement.from.replace(
				/[.*+?^${}()|[\]\\]/g,
				"\\$&"
			)
			newName = newName.replace(new RegExp(escapedPattern, "g"), replacement.to)
		}
	}

	// Then replace fullwidth digits with regular digits
	for (const [fullwidth, regular] of Object.entries(fullwidthDigits)) {
		const escapedPattern = fullwidth.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
		newName = newName.replace(new RegExp(escapedPattern, "g"), regular)
	}

	// Remove trailing "-", "?", or spaces
	newName = newName.replace(/[-? ]+$/g, "")

	return newName
}

// Function to rename a file or folder
function renameItem(oldPath: string, isDirectory: boolean): void {
	const dirName = path.dirname(oldPath)
	const baseName = path.basename(oldPath)
	const newBaseName = cleanupName(baseName)

	if (baseName === newBaseName) {
		// No change needed
		return
	}

	const newPath = path.join(dirName, newBaseName)

	try {
		fs.renameSync(oldPath, newPath)
		if (isDirectory) {
			console.log(`Renamed folder: ${oldPath} → ${newPath}`)
			renamedFoldersCount++
		} else {
			console.log(`Renamed file: ${oldPath} → ${newPath}`)
			renamedFilesCount++
		}
	} catch (error) {
		console.error(
			`Error renaming ${isDirectory ? "folder" : "file"}: ${oldPath}`,
			error
		)
		skippedCount++
	}
}

// Function to process directories recursively, starting from the deepest level
function processDirectory(dirPath: string): void {
	// Get all contents in the directory
	let items: string[]
	try {
		items = fs.readdirSync(dirPath)
	} catch (error) {
		console.error(`Error reading directory: ${dirPath}`, error)
		return
	}

	// Process subdirectories first (go deeper)
	for (const item of items) {
		const itemPath = path.join(dirPath, item)
		const stats = fs.statSync(itemPath)

		if (stats.isDirectory()) {
			// Process subdirectories recursively
			processDirectory(itemPath)
		}
	}

	// After processing all subdirectories, get the updated list (names might have changed)
	try {
		items = fs.readdirSync(dirPath)
	} catch (error) {
		console.error(`Error re-reading directory: ${dirPath}`, error)
		return
	}

	// Now process files in this directory
	for (const item of items) {
		const itemPath = path.join(dirPath, item)
		const stats = fs.statSync(itemPath)

		if (!stats.isDirectory()) {
			// Rename files
			renameItem(itemPath, false)
		}
	}

	// Finally, rename this directory itself (if it's not the root)
	if (dirPath !== rootDir) {
		renameItem(dirPath, true)
	}
}

// Start the process
console.log("Starting cleanup process...")
console.log(`Scanning from root directory: ${rootDir}`)

try {
	processDirectory(rootDir)

	// Print summary
	console.log("\n--- Final Report ---")
	console.log(`Total folders renamed: ${renamedFoldersCount}`)
	console.log(`Total files renamed: ${renamedFilesCount}`)
	console.log(`Total items skipped due to errors: ${skippedCount}`)
	console.log("Cleanup process completed.")
} catch (error) {
	console.error("An error occurred during the cleanup process:", error)
}
