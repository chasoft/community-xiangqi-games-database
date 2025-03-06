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

export type CollectionData = {
	meta: {
		title: string
		description?: string
		tags: string[]
		updatedAt: string
	}
	details: Record<FileName, { preview: string; description: string }>
}

export type BuiltCollectionData = {
	owner: DataGroupOwner
	collections: CollectionName[]
	statistics: Record<CollectionName, number> & { total: number }
	data: Record<
		CollectionName,
		{
			meta: CollectionData["meta"]
			details: Record<
				FileName,
				CollectionData["details"][FileName] & { tags: string[] }
			>
		}
	>
}

export type CollectionDataFull = {
	meta: {
		title: string
		description: string
		tags: string[]
		updatedAt: string
		readme: string
	}
	details: Record<FileName, { preview: string; description: string }>
}
