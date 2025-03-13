import crypto from "crypto"
import fs from "node:fs/promises"
import path from "node:path"
import encodeChunks from "png-chunks-encode"
import extractChunks from "png-chunks-extract"
import puppeteer from "puppeteer"
import ReactDOMServer from "react-dom/server"
import sharp from "sharp"
import type { CollectionData } from "./build.types"

// Extend the Window interface to include __FONTS_LOADED__
declare global {
	interface Window {
		__FONTS_LOADED__: boolean
	}
}

import { FenBoard } from "./components/FenBoard"

// Configuration for screenshot generation
const CONFIG = {
	viewport: { width: 800, height: 800 },
	png: {
		compressionLevel: 9,
		colors: 128,
		quality: 60,
		dither: 1.0
	}
} as const

const PROJECT_ROOT = path.dirname(
	path.dirname(import.meta.url.replace("file:", ""))
)
const BUILD_DIR = path.join(PROJECT_ROOT, "build")
const SCREENSHOTS_DIR = path.join(PROJECT_ROOT, "screenshots")

// Create a hash from preview string
function createHash(preview: string): string {
	return crypto.createHash("sha256").update(preview).digest("hex").slice(0, 12)
}

// Generate HTML for a preview
function generatePreviewHtml(preview: string): string {
	const boardHtml = ReactDOMServer.renderToString(FenBoard({ data: preview }))
	return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
			<style>        
				@import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@200&display=swap');				
				body { 
					margin: 0; 
					padding: 20px;
					font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Open Sans", system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
				}
				#fen-board { 
					max-width: 800px;
					margin: 0 auto;
					padding: 20px;
					border: 1px solid #ccc;
					border-radius: 8px;
				}
				svg text {
					font-weight: normal;
				}
				svg text#website {
					font-weight: 200;
				}
				.fen-board-container {
					position: relative;
					user-select: none;
					border-radius: 0.5rem;
					padding: 10px;
				}
				.fen-board-container:focus-visible {
					outline: 2px solid rgb(245, 158, 11);
					outline-offset: 2px;
				}
				.pieces-container {
					pointer-events: none;
					position: absolute;
					inset: 10px;
					height: 100%;
					width: 100%;
				}
				.piece-wrapper {
					position: absolute;
					inset: 0;
				}
			</style>
			<script>
				document.fonts.ready.then(() => {
					window.__FONTS_LOADED__ = true;
				});
			</script>
        </head>
        <body>
            <div id="fen-board">${boardHtml}</div>
        </body>
        </html>
    `
}

type ProcessingReport = {
	filename: string
	totalPreviews: number
	processedCount: number
	errors: Array<{
		file: string
		error: string
	}>
}

async function processRegisterFile(
	filePath: string,
	existingHashes: Set<string>
): Promise<ProcessingReport> {
	const report: ProcessingReport = {
		filename: path.basename(filePath),
		totalPreviews: 0,
		processedCount: 0,
		errors: []
	}

	try {
		console.log(`Processing ${filePath}...`)
		const data = JSON.parse(
			await fs.readFile(filePath, "utf-8")
		) as CollectionData

		if (!data?.details || typeof data.details !== "object") {
			report.errors.push({ file: filePath, error: "Invalid data structure" })
			return report
		}

		const collectionName = path.basename(filePath, ".register.json")
		report.totalPreviews = Object.values(data.details).filter(
			(d) => d?.preview
		).length

		for (const [filename, details] of Object.entries(data.details)) {
			if (!details?.preview) continue

			try {
				const hash = createHash(details.preview)
				const screenshotPath = path.join(SCREENSHOTS_DIR, `${hash}.png`)

				if (existingHashes.has(hash)) {
					console.log(
						`Skipping existing screenshot for ${filename} (hash: ${hash})`
					)
					continue
				}

				const tempHtmlPath = path.join(SCREENSHOTS_DIR, `${hash}.html`)
				await fs.writeFile(tempHtmlPath, generatePreviewHtml(details.preview))

				try {
					const browser = await puppeteer.launch({
						args: ["--no-sandbox", "--disable-setuid-sandbox"]
					})
					const page = await browser.newPage()
					await page.setViewport(CONFIG.viewport)
					await page.goto(`file://${tempHtmlPath}`)
					// Wait for fonts to be loaded
					await page.waitForFunction(() => window.__FONTS_LOADED__ === true)
					await page.waitForSelector(".fen-board-container")

					const element = await page.$(".fen-board-container")
					if (!element) throw new Error("Board container not found")

					const screenshot = await element.screenshot({
						omitBackground: true
					})

					await browser.close()

					const chunks = extractChunks(screenshot)
					const metadata = {
						author: "Brian Cao",
						twitter: "@vBizChain",
						website: "https://vietcotuong.com",
						preview: details.preview,
						collection: collectionName,
						hash
					}

					for (const [key, value] of Object.entries(metadata)) {
						chunks.splice(-1, 0, {
							name: "tEXt",
							data: Buffer.from(
								`${key}\0${typeof value === "object" ? JSON.stringify(value) : value}`
							)
						})
					}

					const optimizedBuffer = await sharp(screenshot)
						.png({
							...CONFIG.png,
							palette: true
						})
						.toBuffer()

					const optimizedChunks = extractChunks(optimizedBuffer)
					optimizedChunks.splice(
						-1,
						0,
						...chunks.filter((c) => c.name === "tEXt")
					)
					await fs.writeFile(screenshotPath, encodeChunks(optimizedChunks))

					console.log(`Generated screenshot for ${filename} (hash: ${hash})`)
					report.processedCount++
				} catch (err) {
					const error = err as Error
					report.errors.push({
						file: filename,
						error: `Screenshot generation failed: ${error?.message || "Unknown error"}`
					})
					console.error(`Error generating screenshot for ${filename}:`, error)
				} finally {
					await fs.unlink(tempHtmlPath).catch(console.error)
				}
			} catch (err) {
				const error = err as Error
				report.errors.push({
					file: filename,
					error: `Processing failed: ${error?.message || "Unknown error"}`
				})
				console.error(`Error processing ${filename}:`, error)
			}
		}
	} catch (err) {
		const error = err as Error
		report.errors.push({
			file: filePath,
			error: `File read/parse failed: ${error?.message || "Unknown error"}`
		})
		console.error(`Error reading/parsing ${filePath}:`, error)
	}

	return report
}

function printReport(reports: ProcessingReport[]) {
	console.log("\nProcessing Report:")
	console.log("----------------------------------------")
	console.log("Filename | Total Previews | Processed | Errors")
	console.log("----------------------------------------")

	let totalPreviews = 0
	let totalProcessed = 0
	let totalErrors = 0

	for (const report of reports) {
		console.log(
			`${report.filename.padEnd(30)} | ${String(report.totalPreviews).padStart(5)} | ${String(report.processedCount).padStart(5)} | ${String(report.errors.length).padStart(5)}`
		)
		totalPreviews += report.totalPreviews
		totalProcessed += report.processedCount
		totalErrors += report.errors.length
	}

	console.log("----------------------------------------")
	console.log(
		`TOTAL${" ".repeat(25)} | ${String(totalPreviews).padStart(5)} | ${String(totalProcessed).padStart(5)} | ${String(totalErrors).padStart(5)}`
	)
	console.log("----------------------------------------")

	if (totalErrors > 0) {
		console.log("\nError Details:")
		for (const report of reports) {
			if (report.errors.length > 0) {
				console.log(`\n${report.filename}:`)
				for (const error of report.errors) {
					console.log(`  - ${error.file}: ${error.error}`)
				}
			}
		}
	}
}

async function main() {
	const args = process.argv.slice(2)
	const testFile = args[0]

	await fs.mkdir(SCREENSHOTS_DIR, { recursive: true })
	const existingFiles = await fs.readdir(SCREENSHOTS_DIR)
	const existingHashes = new Set(
		existingFiles
			.filter((f) => f.endsWith(".png"))
			.map((f) => f.replace(".png", ""))
	)

	const reports: ProcessingReport[] = []

	if (testFile) {
		const filePath = path.isAbsolute(testFile)
			? testFile
			: path.join(process.cwd(), testFile)
		try {
			const report = await processRegisterFile(filePath, existingHashes)
			reports.push(report)
			console.log("\nTest completed successfully!")
		} catch (error) {
			console.error(`Error processing test file ${filePath}:`, error)
		}
	} else {
		const groups = [
			"community",
			"end-games",
			"mid-games",
			"opening",
			"puzzles",
			"selected-games",
			"tournaments"
		]

		for (const group of groups) {
			const groupPath = path.join(BUILD_DIR, group)
			try {
				const files = await fs.readdir(groupPath)
				const registerFiles = files.filter(
					(f) =>
						f.endsWith(".register.json") &&
						f !== "register.json" &&
						!f.endsWith(".compressed")
				)

				for (const file of registerFiles) {
					const registerPath = path.join(groupPath, file)
					try {
						const report = await processRegisterFile(
							registerPath,
							existingHashes
						)
						reports.push(report)
					} catch (err) {
						const error = err as Error
						console.error(`Error processing ${registerPath}:`, error)
						reports.push({
							filename: file,
							totalPreviews: 0,
							processedCount: 0,
							errors: [
								{
									file: registerPath,
									error: `File processing failed: ${error?.message || "Unknown error"}`
								}
							]
						})
					}
				}
			} catch (err) {
				const error = err as Error
				console.error(`Error reading directory ${groupPath}:`, error)
			}
		}
		console.log("\nAll processing completed!")
	}

	printReport(reports)
}

main().catch(console.error)
