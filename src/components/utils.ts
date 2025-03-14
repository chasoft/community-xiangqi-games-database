import type { PieceId } from "../game.type"
import {
	BlackAdvisor,
	BlackCannon,
	BlackElephant,
	BlackHorse,
	BlackKing,
	BlackPawn,
	BlackRook,
	RedAdvisor,
	RedCannon,
	RedElephant,
	RedHorse,
	RedKing,
	RedPawn,
	RedRook,
	type TPiece
} from "./Pieces.Factory"

export type Position = {
	x: number
	y: number
}

export type BoardTheme = {
	board: {
		background: string
		lines: string
		border: string
		river: string
		labels: string
	}
	pieces: Record<string, TPiece>
	arrows: {
		normal: string
		variant: string
		selected: string
	}
	highlight: {
		from: string
		to: string
	}
}

export const DEFAULT_THEME: BoardTheme = {
	board: {
		background: "#ffedcc",
		lines: "#855E42",
		border: "#855E42",
		river: "#e6d5b8",
		labels: "#855E42"
	},
	arrows: {
		normal: "#4CAF50",
		variant: "blue",
		selected: "#FF5722"
	},
	highlight: {
		from: "#fff4b3",
		to: "#fff4b3"
	},
	pieces: {
		R: RedRook,
		N: RedHorse,
		B: RedElephant,
		A: RedAdvisor,
		K: RedKing,
		C: RedCannon,
		P: RedPawn,
		r: BlackRook,
		n: BlackHorse,
		b: BlackElephant,
		a: BlackAdvisor,
		k: BlackKing,
		c: BlackCannon,
		p: BlackPawn
	}
}

export const HIDDEN_POSITION: Position = { x: 9, y: 9 }

export function equalsPosition(a: Position, b: Position): boolean {
	return a.x === b.x && a.y === b.y
}

export function parsePosition(posStr: string): Position {
	return {
		x: Number.parseInt(posStr.charAt(0)),
		y: Number.parseInt(posStr.charAt(1))
	}
}

const TOTAL_NUMBER_OF_PIECES = 32
export const pieceOrder: { [order: number]: PieceId } = {
	0: "R1",
	1: "N1",
	2: "B1",
	3: "A1",
	4: "K",
	5: "A2",
	6: "B2",
	7: "N2",
	8: "R2",
	9: "C1",
	10: "C2",
	11: "P1",
	12: "P2",
	13: "P3",
	14: "P4",
	15: "P5",
	16: "r1",
	17: "n1",
	18: "b1",
	19: "a1",
	20: "k",
	21: "a2",
	22: "b2",
	23: "n2",
	24: "r2",
	25: "c1",
	26: "c2",
	27: "p1",
	28: "p2",
	29: "p3",
	30: "p4",
	31: "p5"
}

export function getTransform(
	position: Position,
	squareSize: number,
	padding: number
) {
	return {
		transform: `translate(
        ${(position.x - 0.5) * squareSize + padding - 4 + position.x}px,
        ${(position.y - 0.5) * squareSize + padding - 4 + position.y}px
      )`
	}
}
