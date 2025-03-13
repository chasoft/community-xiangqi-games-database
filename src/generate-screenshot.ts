import fs from "node:fs/promises"
import path from "node:path"
import crypto from "crypto"
import puppeteer from "puppeteer"
import ReactDOMServer from "react-dom/server"
import extractChunks from "png-chunks-extract"
import encodeChunks from "png-chunks-encode"
import { FenBoard } from "./components/FenBoard"
import type { CollectionData } from "./build.types"
import sharp from "sharp"

// Configuration for screenshot generation
const CONFIG = {
	// Image dimensions
	viewport: {
		width: 800,
		height: 800
	},
	// PNG output options
	png: {
		compressionLevel: 9, // max compression (0-9)
		colors: 128, // reduce colors for smaller file size
		quality: 60, // lower quality = smaller file (0-100)
		dither: 1.0 // dithering level for color reduction
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
                body { 
                    margin: 0; 
                    padding: 0;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI (Custom)", Roboto, "Helvetica Neue", "Open Sans (Custom)", system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
                }
                #fen-board { 
                    padding: 10px; 
                }
                svg text {
                    font-weight: normal;
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
        </head>
        <body>
            <div id="fen-board">${boardHtml}</div>
        </body>
        </html>
    `
}

async function processRegisterFile(
	filePath: string,
	existingHashes: Set<string>
): Promise<void> {
	console.log(`Processing ${filePath}...`)
	const data = JSON.parse(
		await fs.readFile(filePath, "utf-8")
	) as CollectionData
	const collectionName = path.basename(filePath, ".register.json")

	for (const [filename, details] of Object.entries(data.details)) {
		if (!details.preview) continue

		const hash = createHash(details.preview)
		const screenshotPath = path.join(SCREENSHOTS_DIR, `${hash}.png`)

		// Skip if screenshot already exists
		if (existingHashes.has(hash)) {
			console.log(
				`Skipping existing screenshot for ${filename} (hash: ${hash})`
			)
			continue
		}

		// Generate HTML for this preview
		const html = generatePreviewHtml(details.preview)

		// Save temporary HTML file
		const tempHtmlPath = path.join(SCREENSHOTS_DIR, `${hash}.html`)
		await fs.writeFile(tempHtmlPath, html)

		try {
			// Launch browser with --no-sandbox flag
			const browser = await puppeteer.launch({
				args: ["--no-sandbox", "--disable-setuid-sandbox"]
			})
			const page = await browser.newPage()
			await page.setViewport(CONFIG.viewport)
			await page.goto(`file://${tempHtmlPath}`)

			// Wait for the board container to be rendered
			await page.waitForSelector(".fen-board-container")

			// Get the element
			const element = await page.$(".fen-board-container")
			if (!element) {
				throw new Error("Could not find FenBoard container element")
			}

			// Take screenshot of just the element
			const screenshot = await element.screenshot({
				omitBackground: true // This makes the background transparent
			})

			await browser.close()

			// Extract PNG chunks
			const chunks = extractChunks(screenshot)

			// Create metadata chunk
			const metadata = {
				author: "Brian Cao",
				twitter: "@vBizChain",
				website: "https://vietcotuong.com",
				preview: details.preview,
				filename,
				description: details.description || "",
				collection: collectionName,
				hash
			}

			// Add metadata as tEXt chunks
			for (const [key, value] of Object.entries(metadata)) {
				chunks.splice(-1, 0, {
					name: "tEXt",
					data: Buffer.from(
						`${key}\0${typeof value === "object" ? JSON.stringify(value) : value}`
					)
				})
			}

			// Convert to indexed color mode with sharp for smaller file size
			const optimizedBuffer = await sharp(screenshot)
				.png({
					...CONFIG.png,
					palette: true // Use indexed colors
				})
				.toBuffer()

			// Re-extract chunks from optimized buffer to preserve metadata
			const optimizedChunks = extractChunks(optimizedBuffer)
			optimizedChunks.splice(-1, 0, ...chunks.filter((c) => c.name === "tEXt"))

			// Encode final PNG with metadata
			const pngBuffer = encodeChunks(optimizedChunks)

			// Save the PNG with metadata
			await fs.writeFile(screenshotPath, pngBuffer)

			console.log(`Generated screenshot for ${filename} (hash: ${hash})`)
		} finally {
			// Clean up temp HTML file
			await fs.unlink(tempHtmlPath)
		}
	}
}

async function main() {
	// Get command line arguments
	const args = process.argv.slice(2)
	const testFile = args[0] // Optional file path argument

	// Ensure screenshots directory exists
	await fs.mkdir(SCREENSHOTS_DIR, { recursive: true })

	// Get list of existing screenshots
	const existingFiles = await fs.readdir(SCREENSHOTS_DIR)
	const existingHashes = new Set(
		existingFiles
			.filter((f) => f.endsWith(".png"))
			.map((f) => f.replace(".png", ""))
	)

	if (testFile) {
		// Process single file for testing
		const filePath = path.isAbsolute(testFile)
			? testFile
			: path.join(process.cwd(), testFile)
		try {
			await processRegisterFile(filePath, existingHashes)
			console.log("\nTest completed successfully!")
		} catch (error) {
			console.error(`Error processing test file ${filePath}:`, error)
		}
	} else {
		// Process all register.json files
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
			const registerPath = path.join(groupPath, "register.json")

			try {
				await processRegisterFile(registerPath, existingHashes)
			} catch (error) {
				console.error(`Error processing ${registerPath}:`, error)
			}
		}
		console.log("\nAll processing completed!")
	}
}

main().catch(console.error)
