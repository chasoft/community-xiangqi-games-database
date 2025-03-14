import crypto from "crypto"

export function createHash(preview: string): string {
	return crypto.createHash("sha256").update(preview).digest("hex").slice(0, 12)
}
