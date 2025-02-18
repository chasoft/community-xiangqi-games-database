/**
 * Community XiangQi Games Database
 */

export type CollectionName = string
export type TournamentName = string
export type FileName = string
export type FileDescription = string
export type TournamentYear = string

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
    { readme: string; unpdatedAt: number } & Record<FileName, FileDescription>
  >
}

export type TournamentsRegister = {
  owner: "tournaments"
  register: TournamentName[]
}

export type Tournament = {
  name: TournamentName
  data: Record<TournamentYear, DataGroup["data"]>
}
