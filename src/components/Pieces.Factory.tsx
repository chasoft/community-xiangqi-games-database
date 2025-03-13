export type PieceProps = {
	radius: number
}

export type TPiece = (props: PieceProps) => React.ReactElement

const createPiece =
	(color: string, character: string, title: string) =>
	({ radius: size }: PieceProps) => (
		<svg style={{ height: size * 2 + 4, width: size * 2 + 4 }}>
			<title>{title}</title>
			<circle
				cx={size}
				cy={size}
				r={size * 0.92}
				fill={color}
				style={{ filter: "drop-shadow(2px 2px 2px rgba(0, 0, 0, 0.5))" }}
			/>
			<text
				x={size}
				y={size}
				fill="white"
				fontSize={size * 1.2}
				textAnchor="middle"
				dominantBaseline="central"
				style={{
					userSelect: "none"
				}}
			>
				{character}
			</text>
		</svg>
	)

export const RedRook = createPiece("#d00", "車", "Red Rook")
export const RedHorse = createPiece("#d00", "馬", "Red Horse")
export const RedElephant = createPiece("#d00", "象", "Red Elephant")
export const RedAdvisor = createPiece("#d00", "士", "Red Advisor")
export const RedKing = createPiece("#d00", "帥", "Red King")
export const RedCannon = createPiece("#d00", "炮", "Red Cannon")
export const RedPawn = createPiece("#d00", "兵", "Red Pawn")

export const BlackRook = createPiece("#000", "車", "Black Rook")
export const BlackHorse = createPiece("#000", "馬", "Black Horse")
export const BlackElephant = createPiece("#000", "象", "Black Elephant")
export const BlackAdvisor = createPiece("#000", "士", "Black Advisor")
export const BlackKing = createPiece("#000", "將", "Black King")
export const BlackCannon = createPiece("#000", "炮", "Black Cannon")
export const BlackPawn = createPiece("#000", "卒", "Black Pawn")
