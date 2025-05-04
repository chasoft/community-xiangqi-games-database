import { readdir, readFile, writeFile } from "node:fs/promises"
import { join, parse } from "node:path"

async function getAllFiles(dir: string): Promise<string[]> {
	const files: string[] = []
	const items = await readdir(dir, { withFileTypes: true })

	for (const item of items) {
		const fullPath = join(dir, item.name)
		if (item.isDirectory()) {
			files.push(...(await getAllFiles(fullPath)))
		} else {
			files.push(fullPath)
		}
	}

	return files
}

async function updateDhtmlXQTitle(
	filePath: string
): Promise<{ updated: boolean; oldTitle?: string }> {
	const content = await readFile(filePath, "utf-8")
	const filename = parse(filePath).name

	const titleMatch = content.match(/\[DhtmlXQ_title\](.*?)\[\/DhtmlXQ_title\]/)
	if (!titleMatch) {
		console.log(`Warning: No DhtmlXQ_title tag found in ${filePath}`)
		return { updated: false }
	}

	const oldTitle = titleMatch[1]
	if (oldTitle === filename) {
		return { updated: false }
	}

	const newContent = content.replace(
		/\[DhtmlXQ_title\](.*?)\[\/DhtmlXQ_title\]/,
		`[DhtmlXQ_title]${filename}[/DhtmlXQ_title]`
	)

	await writeFile(filePath, newContent, "utf-8")
	return { updated: true, oldTitle }
}

async function main() {
	const dataDir = join(process.cwd(), "data")
	const files = await getAllFiles(dataDir)

	let totalFiles = 0
	let updatedFiles = 0
	const changes: { file: string; oldTitle: string; newTitle: string }[] = []

	for (const file of files) {
		totalFiles++
		const { updated, oldTitle } = await updateDhtmlXQTitle(file)

		if (updated) {
			updatedFiles++
			changes.push({
				file: file.replace(process.cwd(), ""),
				oldTitle: oldTitle as string,
				newTitle: parse(file).name
			})
		}
	}

	// Print report
	console.log("\nUpdate Report:")
	console.log("=============")
	console.log(`Total files scanned: ${totalFiles}`)
	console.log(`Files updated: ${updatedFiles}`)

	if (changes.length > 0) {
		console.log("\nDetailed changes:")
		console.log("================")
		for (const { file, oldTitle, newTitle } of changes) {
			console.log(`\nFile: ${file}`)
			console.log(`Old title: ${oldTitle}`)
			console.log(`New title: ${newTitle}`)
		}
	}
}

main().catch(console.error)
