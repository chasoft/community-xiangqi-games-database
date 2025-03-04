import type { PieceData, PieceId, Position } from "./game.type"

export const NEW_GAME_BINIT =
	"0919293949596979891777062646668600102030405060708012720323436383"

export function gameStartedFromTheBegining(bInit: string): boolean {
	return bInit === NEW_GAME_BINIT
}

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

export function equalsPosition(a: Position, b: Position): boolean {
	return a.x === b.x && a.y === b.y
}

export function parsePosition(posStr: string): Position {
	return {
		x: Number.parseInt(posStr.charAt(0)),
		y: Number.parseInt(posStr.charAt(1))
	}
}

export function findPieceAtPosition(
	pieces: Record<PieceId, PieceData>,
	pos: Position
): PieceId | undefined {
	for (const [pieceId, pieceData] of Object.entries(pieces)) {
		if (equalsPosition(pieceData.position, pos)) {
			return pieceId as PieceId
		}
	}
	return undefined
}

export const getEmptyPieces = () =>
	Object.keys(pieceOrder).reduce(
		(acc, key) => {
			const pieceId = pieceOrder[Number(key)]
			acc[pieceId] = {
				id: pieceId,
				position: { x: 9, y: 9 }
			}
			return acc
		},
		{} as Record<PieceId, PieceData>
	)

export function parseBinit(binit: string): Record<PieceId, PieceData> {
	const pieces: Record<PieceId, PieceData> = getEmptyPieces()
	const pairCount = Math.floor(binit.length / 2)
	for (let i = 0; i < pairCount && i < 32; i++) {
		const pair = binit.substring(i * 2, i * 2 + 2)
		const position = parsePosition(pair)
		const id = pieceOrder[i]
		pieces[id] = { id, position }
	}
	return pieces
}

export function getLastPiecesPosition(movelist: string): string {
	const pieces: Record<PieceId, PieceData> = parseBinit(NEW_GAME_BINIT)
	const moveCount = movelist.length / 4

	for (let moveOrder = 0; moveOrder < moveCount; moveOrder++) {
		const group = movelist.substring(moveOrder * 4, moveOrder * 4 + 4)
		const from = parsePosition(group.substring(0, 2))
		const to = parsePosition(group.substring(2, 4))

		const fromPieceId = findPieceAtPosition(pieces, from)

		if (!fromPieceId) {
			console.error({
				pieces,
				moveOrder,
				from,
				to
			})
			throw new Error("Piece not found at from position.")
		}

		const toPieceId = findPieceAtPosition(pieces, to)

		if (toPieceId) {
			pieces[toPieceId].position = { x: 9, y: 9 }
		}

		pieces[fromPieceId].position = to
	}

	let binit = ""
	for (let i = 0; i < 32; i++) {
		const pieceId = pieceOrder[i]
		const piece = pieces[pieceId]
		binit += `${piece.position.x}${piece.position.y}`
	}
	return binit
}
