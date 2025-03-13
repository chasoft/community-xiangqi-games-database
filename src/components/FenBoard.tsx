import type { PieceId } from "../game.type"
import {
	DEFAULT_THEME,
	HIDDEN_POSITION,
	type Position,
	equalsPosition,
	getTransform,
	parsePosition,
	pieceOrder
} from "./utils"

import "./FenBoard.css"

const DEFAUL_FENBOARD_SIZE = 400

type PieceData = { id: PieceId; initPosition: Position }

const getEmptyPieces = () =>
	Object.keys(pieceOrder).reduce(
		(acc, key) => {
			const pieceId = pieceOrder[Number(key)]
			acc[pieceId] = {
				id: pieceId,
				initPosition: { x: 9, y: 9 }
			}
			return acc
		},
		{} as Record<PieceId, PieceData>
	)

function convertBinitToPieces(binit: string): Record<PieceId, PieceData> {
	const pieces: Record<PieceId, PieceData> = getEmptyPieces()
	const pairCount = Math.floor(binit.length / 2)
	for (let i = 0; i < pairCount && i < 32; i++) {
		const pair = binit.substring(i * 2, i * 2 + 2)
		const initPosition = parsePosition(pair)
		const pieceId = pieceOrder[i]
		pieces[pieceId] = {
			id: pieceId,
			initPosition
		}
	}
	return pieces
}

type FendBoardProps = {
	data: string
	boardSize?: number
}

/**
 * We need highly optimize so, we use magic number with comments
 */
export function FenBoard({
	data,
	boardSize = DEFAUL_FENBOARD_SIZE
}: FendBoardProps) {
	const piecesData = convertBinitToPieces(data)

	// Calculate dynamic measurements
	const reservedSpace = 10
	const availableSpace = boardSize - 2 * reservedSpace
	const squareSize = availableSpace / 9

	// Adjust total dimensions
	const boardWidth = 9 * squareSize
	const boardHeight = 10 * squareSize
	const totalWidth = boardWidth + 2 * reservedSpace
	const totalHeight = boardHeight + 2 * reservedSpace

	// Calculate scale to fit container
	const scale = boardSize / Math.max(totalWidth, totalHeight)
	const padding = (boardSize - squareSize * (9 - 1)) / 2

	return (
		<div
			className="fen-board-container"
			style={{
				width: totalWidth * scale + 2,
				height: totalHeight * scale + 2
			}}
		>
			<svg viewBox={`0 0 ${totalWidth + 1} ${totalHeight + 1}`}>
				<title>FenBoard</title>
				<rect
					x={0}
					y={0}
					width={totalWidth}
					height={totalHeight}
					fill={DEFAULT_THEME.board.background}
					stroke={DEFAULT_THEME.board.border}
					strokeWidth={1}
					rx={10}
					ry={10}
				/>
				{/****************************************************
				 *
				 *     BoardGrid
				 *
				 ***************************************************/}
				<g stroke={DEFAULT_THEME.board.lines} strokeWidth="0.75">
					{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((_, i) => (
						<line
							key={`h${i}`}
							x1={padding}
							y1={padding + i * squareSize}
							x2={padding + 8 * squareSize}
							y2={padding + i * squareSize}
						/>
					))}
					<line
						key="v-left-border"
						x1={padding}
						y1={padding}
						x2={padding}
						y2={padding + 9 * squareSize}
					/>
					<line
						key="v-right-border"
						x1={padding + 8 * squareSize}
						y1={padding}
						x2={padding + 8 * squareSize}
						y2={padding + 9 * squareSize}
					/>
					{[0, 1, 2, 3, 4, 5, 6].map((_, i) => (
						<line
							key={`v-top-${i + 1}`}
							x1={padding + (i + 1) * squareSize}
							y1={padding}
							x2={padding + (i + 1) * squareSize}
							y2={padding + 4 * squareSize}
						/>
					))}
					{[0, 1, 2, 3, 4, 5, 6].map((_, i) => (
						<line
							key={`v-bottom-${i + 1}`}
							x1={padding + (i + 1) * squareSize}
							y1={padding + 5 * squareSize}
							x2={padding + (i + 1) * squareSize}
							y2={padding + 9 * squareSize}
						/>
					))}
					<text
						x={padding + (8 * squareSize) / 2}
						y={padding + 4.5 * squareSize}
						textAnchor="middle"
						dominantBaseline="middle"
						fill={DEFAULT_THEME.board.lines}
						fontSize={squareSize * 0.4}
						letterSpacing={squareSize * 0.25}
					>
						楚 河 汉 界
					</text>
					{/* Position Marks */}
					{[
						{ x: 1, y: 2 },
						{ x: 7, y: 2 },
						{ x: 1, y: 7 },
						{ x: 7, y: 7 },
						...[0, 2, 4, 6, 8].map((x) => ({ x, y: 3 })),
						...[0, 2, 4, 6, 8].map((x) => ({ x, y: 6 }))
					].map((pos, i) => (
						<g key={`mark-${i}`}>
							{pos.x !== 0 && (
								<path
									d={`M${padding + pos.x * squareSize - 3} 
                                 ${padding + pos.y * squareSize - 8}
                                 v5 h-5`}
									fill="none"
									stroke={DEFAULT_THEME.board.lines}
									strokeWidth="0.75"
								/>
							)}
							{pos.x !== 8 && (
								<path
									d={`M${padding + pos.x * squareSize + 3} 
                                 ${padding + pos.y * squareSize - 8}
                                 v5 h5`}
									fill="none"
									stroke={DEFAULT_THEME.board.lines}
									strokeWidth="0.75"
								/>
							)}
							{pos.x !== 0 && (
								<path
									d={`M${padding + pos.x * squareSize - 3}
                                 ${padding + pos.y * squareSize + 8} v-5 h-5`}
									fill="none"
									stroke={DEFAULT_THEME.board.lines}
									strokeWidth="0.75"
								/>
							)}
							{pos.x !== 8 && (
								<path
									d={`M${padding + pos.x * squareSize + 3}
                                 ${padding + pos.y * squareSize + 8} v-5 h5`}
									fill="none"
									stroke={DEFAULT_THEME.board.lines}
									strokeWidth="0.75"
								/>
							)}
						</g>
					))}
					<path
						d={`M${padding + 3 * squareSize} ${padding} L${padding + 5 * squareSize}  ${padding + 2 * squareSize}`}
					/>
					<path
						d={`M${padding + 5 * squareSize} 
                         ${padding}
                         L${padding + 3 * squareSize} 
                         ${padding + 2 * squareSize}`}
					/>
					<path
						d={`M${padding + 3 * squareSize} 
                         ${padding + 7 * squareSize}
                         L${padding + 5 * squareSize} 
                         ${padding + 9 * squareSize}`}
					/>
					<path
						d={`M${padding + 5 * squareSize} 
                         ${padding + 7 * squareSize}
                         L${padding + 3 * squareSize} 
                         ${padding + 9 * squareSize}`}
					/>
				</g>
			</svg>

			<div className="pieces-container">
				{Object.values(piecesData).map((pieceData) => {
					const { initPosition } = pieceData

					const pieceSize = squareSize * (8 / 9)
					const PieceComponent =
						pieceData && DEFAULT_THEME.pieces[pieceData?.id[0]]

					if (equalsPosition(initPosition, HIDDEN_POSITION)) return null

					return (
						<div
							key={pieceData.id}
							className="piece-wrapper"
							style={{
								...getTransform(initPosition, pieceSize, padding),
								width: pieceSize + 4,
								height: pieceSize + 4
							}}
						>
							{PieceComponent && <PieceComponent radius={pieceSize / 2} />}
						</div>
					)
				})}
			</div>
		</div>
	)
}
