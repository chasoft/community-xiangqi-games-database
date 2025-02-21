/**
 * Community XiangQi Games Database
 */

export type CollectionName = string
export type FileName = string

export type DataGroupOwner =
	| "community"
	| "end-games"
	| "mid-games"
	| "opening"
	| "puzzles"
	| "selected-games"
	| "tournaments"

export type DataGroup = {
	owner: DataGroupOwner
	data: Record<
		CollectionName,
		{
			meta: {
				title: string
				description: string
				tags: string[]
				updatedAt: string
				hasReadme: boolean
			}
			details: Record<FileName, { preview: string; description: string; tags: string[] }>
		}
	>
}
