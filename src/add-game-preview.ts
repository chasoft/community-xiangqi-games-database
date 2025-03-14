import path from "node:path"
import { fileURLToPath } from "node:url"
import fs from "node:fs/promises"
import chalk from "chalk"
import Table from "cli-table3"
import { createHash } from "./utils"
import type { CollectionDataFull } from "./build.types"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, "..")

type ProcessStats = {
	folder: string
	collectionName: string
	totalFiles: number
	updatedFiles: number
	skippedFiles: number
	errors: Array<{ file: string; error: string }>
}

async function updateGamePreview(
	dataFilePath: string,
	preview: string
): Promise<boolean> {
	try {
		const content = await fs.readFile(dataFilePath, "utf-8")
		const previewTag = "[DhtmlXQ_gamepreview]"
		const previewEndTag = "[/DhtmlXQ_gamepreview]"
		const endXQTag = "[/DhtmlXQ]"

		const newPreview = `${createHash(preview)}.png`
		const previewPattern =
			/\[DhtmlXQ_gamepreview\](.*)\[\/DhtmlXQ_gamepreview\]/s

		// Check if preview tag exists and content matches
		const match = content.match(previewPattern)
		if (match && match[1].trim() === newPreview) {
			return false // No update needed
		}

		let newContent: string
		if (match) {
			// Replace existing preview
			newContent = content.replace(
				previewPattern,
				`${previewTag}${newPreview}${previewEndTag}`
			)
		} else {
			// Add new preview just before [/DhtmlXQ]
			newContent = content.replace(
				endXQTag,
				`${previewTag}${newPreview}${previewEndTag}\n${endXQTag}`
			)
		}

		await fs.writeFile(dataFilePath, newContent)
		return true
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Failed to update game preview: ${error.message}`)
		}
		throw new Error("Failed to update game preview: Unknown error")
	}
}

async function processCollection(
	buildPath: string,
	dataPath: string,
	folder: string,
	filename: string
): Promise<ProcessStats> {
	const stats: ProcessStats = {
		folder,
		collectionName: filename,
		totalFiles: 0,
		updatedFiles: 0,
		skippedFiles: 0,
		errors: []
	}

	try {
		const content = await fs.readFile(
			path.join(buildPath, folder, filename),
			"utf-8"
		)
		const data = JSON.parse(content) as CollectionDataFull

		stats.totalFiles = Object.keys(data.details).length
		const collectionFolder = filename.replace(".register.json", "")

		for (const [file, details] of Object.entries(data.details)) {
			try {
				const dataFilePath = path.join(dataPath, folder, collectionFolder, file)

				try {
					await fs.access(dataFilePath)
				} catch {
					// Skip if file doesn't exist in data directory
					stats.errors.push({
						file,
						error: "File not found in data directory"
					})
					continue
				}

				const updated = await updateGamePreview(dataFilePath, details.preview)
				if (updated) {
					stats.updatedFiles++
				} else {
					stats.skippedFiles++
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : "Unknown error"
				stats.errors.push({ file, error: message })
			}
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error"
		stats.errors.push({
			file: filename,
			error: `Failed to process collection: ${message}`
		})
	}

	return stats
}

function printReport(allStats: ProcessStats[]) {
	const table = new Table({
		head: [
			chalk.cyan("Folder"),
			chalk.cyan("Collection"),
			chalk.cyan("Total"),
			chalk.cyan("Updated"),
			chalk.cyan("Skipped"),
			chalk.cyan("Errors")
		]
	})

	let totalFiles = 0
	let totalUpdated = 0
	let totalSkipped = 0
	let totalErrors = 0

	for (const stats of allStats) {
		table.push([
			stats.folder,
			stats.collectionName,
			stats.totalFiles,
			chalk.green(stats.updatedFiles),
			chalk.yellow(stats.skippedFiles),
			chalk.red(stats.errors.length)
		])

		totalFiles += stats.totalFiles
		totalUpdated += stats.updatedFiles
		totalSkipped += stats.skippedFiles
		totalErrors += stats.errors.length

		// Print errors if any
		if (stats.errors.length > 0) {
			console.log(
				chalk.red(`\nErrors in ${stats.folder}/${stats.collectionName}:`)
			)
			for (const error of stats.errors) {
				console.log(chalk.red(`  - ${error.file}: ${error.error}`))
			}
		}
	}

	table.push([
		chalk.bold("Total"),
		"",
		chalk.bold(totalFiles),
		chalk.bold.green(totalUpdated),
		chalk.bold.yellow(totalSkipped),
		chalk.bold.red(totalErrors)
	])

	console.log(table.toString())
}

async function main() {
	const buildPath = path.join(PROJECT_ROOT, "build")
	const dataPath = path.join(PROJECT_ROOT, "data")
	const stats: ProcessStats[] = []

	try {
		const folders = await fs.readdir(buildPath)

		for (const folder of folders) {
			const folderPath = path.join(buildPath, folder)
			const folderStat = await fs.stat(folderPath)

			if (!folderStat.isDirectory()) continue

			const files = await fs.readdir(folderPath)
			const registerFiles = files.filter(
				(file) =>
					file.endsWith(".register.json") &&
					file !== "register.json" &&
					!file.endsWith(".compressed")
			)

			for (const file of registerFiles) {
				const collectionStats = await processCollection(
					buildPath,
					dataPath,
					folder,
					file
				)
				stats.push(collectionStats)
			}
		}

		printReport(stats)
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error"
		console.error(chalk.red(`Fatal error: ${message}`))
		process.exit(1)
	}
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : "Unknown error"
	console.error(chalk.red(`Fatal error: ${message}`))
	process.exit(1)
})
