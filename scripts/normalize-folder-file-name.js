#!/usr/bin/env node

import { promises as fs } from "node:fs"
import { resolve, join } from "node:path"

// Configuration
const targetDirectory = resolve(__dirname, "../data/tournaments")

// Characters to replace and their replacements
const replacements = {
	"（": "(",
	"）": ")",
	" ": "-",
	"，": "-"
}

/**
 * Normalizes a filename by applying the defined character replacements
 * @param {string} name - The filename or directory name to normalize
 * @returns {string} - The normalized name
 */
function normalizeName(name) {
	let normalizedName = name
	// Apply character replacements
	for (const [oldChar, newChar] of Object.entries(replacements)) {
		normalizedName = normalizedName.replace(new RegExp(oldChar, "g"), newChar)
	}

	// Remove specific suffixes
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
		// Remove any trailing spaces that might remain after suffix removal
		.trim()

	return normalizedName
}

/**
 * Recursively processes all files and folders in a directory
 * @param {string} dirPath - The directory to process
 * @param {number} totalItems - Total items to process (for progress tracking)
 * @param {number} processedItems - Items already processed
 * @returns {Promise<number>} - The updated count of processed items
 */
async function processDirectory(dirPath, totalItems, initialCount = 0) {
	// Read all items in the directory
	const items = await fs.readdir(dirPath)

	// Use a local variable instead of modifying the parameter
	let processedItems = initialCount

	// Process each item
	for (const item of items) {
		const itemPath = join(dirPath, item)
		const normalizedItem = normalizeName(item)
		const normalizedPath = join(dirPath, normalizedItem)

		// Get item stats to check if it's a directory
		const stats = await fs.stat(itemPath)

		// If the name needs normalization, rename it
		if (item !== normalizedItem) {
			try {
				await fs.rename(itemPath, normalizedPath)
				console.log(`Renamed: ${itemPath} → ${normalizedPath}`)
			} catch (error) {
				console.error(`Error renaming ${itemPath}:`, error.message)
			}
		}

		// If it's a directory, process its contents recursively
		if (stats.isDirectory()) {
			processedItems = await processDirectory(
				normalizedPath,
				totalItems,
				processedItems
			)
		}

		// Update progress
		processedItems++
		const progress = Math.floor((processedItems / totalItems) * 100)
		process.stdout.write(
			`\rProgress: ${progress}% (${processedItems}/${totalItems})`
		)
	}

	return processedItems
}

/**
 * Counts the total number of files and directories to process for progress tracking
 * @param {string} dirPath - The starting directory
 * @returns {Promise<number>} - Total count of files and directories
 */
async function countItems(dirPath) {
	let count = 0
	const items = await fs.readdir(dirPath)

	count += items.length

	for (const item of items) {
		const itemPath = join(dirPath, item)
		const stats = await fs.stat(itemPath)

		if (stats.isDirectory()) {
			count += await countItems(itemPath)
		}
	}

	return count
}

/**
 * Main function to normalize all folders and files
 */
async function main() {
	try {
		console.log(`Starting normalization in ${targetDirectory}`)

		// Count total items for progress tracking
		console.log("Counting files and folders...")
		const totalItems = await countItems(targetDirectory)
		console.log(`Found ${totalItems} files and folders to process.`)

		// Process all items
		console.log("Starting normalization process...")
		await processDirectory(targetDirectory, totalItems)

		console.log("\nNormalization completed successfully!")
	} catch (error) {
		console.error("Error during normalization:", error.message)
		process.exit(1)
	}
}

main()
