import fs from "node:fs"
import path from "node:path"
import chalk from "chalk"
import Table from "cli-table3"
import { glob } from "glob"

const domain = "https://vietcotuong.com"
const buildDir = path.resolve(__dirname, "../build")
const dataDir = path.resolve(__dirname, "../data")
const sitemapDir = path.resolve(__dirname, "../sitemap")

interface RegisterMeta {
	title: string
	description: string
	updatedAt?: string
}

interface RegisterDetails {
	[key: string]: {
		preview: string
		description: string
		gamePreview?: string
		tags: string[]
	}
}

interface RegisterFile {
	meta: RegisterMeta
	details: RegisterDetails
}

function getLastModifiedDate(filePath: string, updatedAt?: string): string {
	try {
		if (fs.existsSync(filePath)) {
			const stats = fs.statSync(filePath)
			return stats.mtime.toISOString()
		}
	} catch (error) {
		// File doesn't exist or can't be accessed
	}

	// Fallback to updatedAt or current date
	return updatedAt
		? new Date(updatedAt).toISOString()
		: new Date().toISOString()
}

function generateSitemapXML(urls: { loc: string; lastmod: string }[]): string {
	const urlset = urls
		.map(
			({ loc, lastmod }) => `
    <url>
        <loc>${loc}</loc>
        <lastmod>${lastmod}</lastmod>
    </url>`
		)
		.join("")

	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urlset}
</urlset>`
}

function generateSitemapIndex(
	sitemaps: { loc: string; lastmod: string }[]
): string {
	const sitemapList = sitemaps
		.map(
			({ loc, lastmod }) => `
    <sitemap>
        <loc>${loc}</loc>
        <lastmod>${lastmod}</lastmod>
    </sitemap>`
		)
		.join("")

	return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${sitemapList}
</sitemapindex>`
}

async function buildSitemap() {
	console.log(chalk.blue.bold("\n🗺️  Building XML Sitemaps...\n"))

	// Ensure sitemap directory exists
	if (!fs.existsSync(sitemapDir)) {
		fs.mkdirSync(sitemapDir, { recursive: true })
	}

	const sitemapFiles: { loc: string; lastmod: string }[] = []
	const stats = {
		totalCollections: 0,
		totalUrls: 0,
		collectionStats: [] as { collection: string; urls: number; size: number }[]
	}

	// Find all register.json files (excluding .compressed and root register.json)
	const registerFiles = await glob("*/*.register.json", {
		cwd: buildDir,
		ignore: ["*/*.compressed", "*/register.json"]
	})

	console.log(
		chalk.yellow(`Found ${registerFiles.length} collections to process\n`)
	)

	for (const registerFile of registerFiles) {
		const [ownerId, filename] = registerFile.split("/")
		const collectionId = filename.replace(".register.json", "")

		process.stdout.write(
			chalk.cyan(`Processing ${chalk.bold(collectionId)}... `)
		)

		const registerPath = path.join(buildDir, registerFile)
		const registerData: RegisterFile = JSON.parse(
			fs.readFileSync(registerPath, "utf-8")
		)

		const urls: { loc: string; lastmod: string }[] = []

		// Add collection URL
		const collectionUrl = `${domain}/explore/${ownerId}/${collectionId}`
		const collectionDataPath = path.join(dataDir, ownerId, collectionId)
		urls.push({
			loc: collectionUrl,
			lastmod: getLastModifiedDate(
				collectionDataPath,
				registerData.meta.updatedAt
			)
		})

		// Add URLs for each file in the collection
		for (const [fileId, details] of Object.entries(registerData.details)) {
			const fileUrl = `${collectionUrl}/${fileId}`
			const dataFilePath = path.join(dataDir, ownerId, collectionId, fileId)
			urls.push({
				loc: fileUrl,
				lastmod: getLastModifiedDate(dataFilePath, registerData.meta.updatedAt)
			})
		}

		// Generate sitemap for this collection
		const sitemapFilename = `sitemap-${collectionId}.xml`
		const sitemapPath = path.join(sitemapDir, sitemapFilename)
		const sitemapContent = generateSitemapXML(urls)
		fs.writeFileSync(sitemapPath, sitemapContent)

		// Add to sitemap index
		sitemapFiles.push({
			loc: `${domain}/sitemap/${sitemapFilename}`,
			lastmod: new Date().toISOString()
		})

		// Update stats
		stats.totalCollections++
		stats.totalUrls += urls.length
		stats.collectionStats.push({
			collection: collectionId,
			urls: urls.length,
			size: Buffer.from(sitemapContent).length
		})

		console.log(chalk.green(`✓ (${urls.length} URLs)`))
	}

	// Generate sitemap index
	const indexPath = path.join(sitemapDir, "sitemap.xml")
	const indexContent = generateSitemapIndex(sitemapFiles)
	fs.writeFileSync(indexPath, indexContent)

	// Print summary table
	console.log(chalk.blue.bold("\n📊 Sitemap Generation Summary\n"))

	const summaryTable = new Table({
		head: [
			chalk.white.bold("Collection"),
			chalk.white.bold("URLs"),
			chalk.white.bold("Size")
		],
		style: {
			head: [],
			border: []
		}
	})

	for (const { collection, urls, size } of stats.collectionStats) {
		summaryTable.push([
			collection,
			urls.toString(),
			`${(size / 1024).toFixed(2)} KB`
		])
	}

	console.log(summaryTable.toString())

	console.log(
		chalk.green.bold(`\n✨ Total Collections: ${stats.totalCollections}`)
	)
	console.log(chalk.green.bold(`📝 Total URLs: ${stats.totalUrls}`))
	console.log(chalk.green.bold(`📂 Sitemaps saved in: ${sitemapDir}\n`))
}

buildSitemap().catch(console.error)
