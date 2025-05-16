const BUCKET = "vietcotuong"
const ROOT = "/home/brian/projects/sample-data-for-r2"

const genCliner = (relativePath: string) => {
	/**
	 * sample command:
	 * bunx wrangler r2 object put vietcotuong/processed/stats.json --file /home/brian/projects/sample-data-for-r2/processed/stats.json
	 */
	return `bunx wrangler r2 object put ${BUCKET}/${relativePath} --file ${ROOT}/${relativePath}`
}
