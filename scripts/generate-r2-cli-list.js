// filepath: /home/brian/projects/community-xiangqi-games-database/scripts/generate-r2-local-import.ts
const BUCKET = "vietcotuong"
const ROOT = "/home/brian/projects/sample-data-for-r2"
const fs = require("node:fs")
const path = require("node:path")

const genCliner = (relativePath) => {
	/**
	 * sample command:
	 * bunx wrangler r2 object put vietcotuong/processed/stats.json --file /home/brian/projects/sample-data-for-r2/processed/stats.json
	 */
	return `bunx wrangler r2 object put ${BUCKET}/${relativePath} --file ${ROOT}/${relativePath}`
}

function walkDir(dir, callback, baseDir = dir) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name)
		const relPath = path.relative(baseDir, fullPath)
		if (entry.isDirectory()) {
			walkDir(fullPath, callback, baseDir)
		} else if (entry.isFile()) {
			callback(relPath.replace(/\\/g, "/"))
		}
	}
}

const output = []
walkDir(ROOT, (relPath) => {
	output.push(genCliner(relPath))
})

fs.writeFileSync(
	"/home/brian/projects/community-xiangqi-games-database/r2_cli.txt",
	output.join("\n")
)
console.log(`Generated r2_cli.txt with ${output.length} lines.`)
