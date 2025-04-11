#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs"
import { join } from "node:path"
import { createInterface } from "node:readline"

// Create readline interface for user input
const rl = createInterface({
	input: process.stdin,
	output: process.stdout
})

// Function to ask questions and get user input
function askQuestion(query) {
	return new Promise((resolve) => {
		rl.question(query, (answer) => {
			resolve(answer)
		})
	})
}

// Function to search and replace text in a file
async function searchReplaceInFile(filePath, searchText, replaceText) {
	try {
		// Read file content
		const content = readFileSync(filePath, "utf8")

		// Check if the file contains the search text
		if (content.includes(searchText)) {
			// Replace all occurrences of the search text
			const newContent = content.split(searchText).join(replaceText)

			// Write the modified content back to file
			writeFileSync(filePath, newContent, "utf8")

			console.log(`Modified: ${filePath}`)
			return true
		}
		return false
	} catch (error) {
		console.error(`Error processing file ${filePath}: ${error.message}`)
		return false
	}
}

// Function to recursively process all files in a directory
async function processDirectory(dirPath, searchText, replaceText) {
	try {
		const entries = readdirSync(dirPath, { withFileTypes: true })

		let modifiedCount = 0
		let totalFiles = 0

		for (const entry of entries) {
			const fullPath = join(dirPath, entry.name)

			if (entry.isDirectory()) {
				// Process subdirectories recursively
				const subDirStats = await processDirectory(
					fullPath,
					searchText,
					replaceText
				)
				modifiedCount += subDirStats.modifiedCount
				totalFiles += subDirStats.totalFiles
			} else {
				// Process files
				totalFiles++
				if (await searchReplaceInFile(fullPath, searchText, replaceText)) {
					modifiedCount++
				}
			}
		}

		return { modifiedCount, totalFiles }
	} catch (error) {
		console.error(`Error processing directory ${dirPath}: ${error.message}`)
		return { modifiedCount: 0, totalFiles: 0 }
	}
}

// Main function
async function main() {
	try {
		// Get user input
		const dirPath = await askQuestion("Enter the directory path: ")
		const searchText = await askQuestion("Enter the text to search for: ")
		const replaceText = await askQuestion("Enter the replacement text: ")

		// Validate directory path
		if (!existsSync(dirPath)) {
			console.error(`Directory not found: ${dirPath}`)
			rl.close()
			return
		}

		console.log("\nStarting search and replace operation...")
		console.log(`Directory: ${dirPath}`)
		console.log(`Searching for: "${searchText}"`)
		console.log(`Replacing with: "${replaceText}"`)

		const confirmResponse = await askQuestion(
			"\nDo you want to continue? (y/n): "
		)

		if (confirmResponse.toLowerCase() !== "y") {
			console.log("Operation cancelled.")
			rl.close()
			return
		}

		// Process directory and all subdirectories
		const { modifiedCount, totalFiles } = await processDirectory(
			dirPath,
			searchText,
			replaceText
		)

		console.log("\nOperation completed!")
		console.log(`Total files processed: ${totalFiles}`)
		console.log(`Files modified: ${modifiedCount}`)
	} catch (error) {
		console.error(`An error occurred: ${error.message}`)
	} finally {
		rl.close()
	}
}

// Run the main function
main()
