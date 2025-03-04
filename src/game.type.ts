export type Position = {
	x: number
	y: number
}

export type PieceId =
	| "R1" // 俥
	| "R2" // 俥
	| "N1" // 傌
	| "N2" // 傌
	| "B1" // 相
	| "B2" // 相
	| "A1" // 仕
	| "A2" // 仕
	| "K" // 帥
	| "C1" // 炮
	| "C2" // 炮
	| "P1" // 兵
	| "P2" // 兵
	| "P3" // 兵
	| "P4" // 兵
	| "P5" // 兵
	| "r1" // 俥
	| "r2" // 俥
	| "n1" // 馬
	| "n2" // 馬
	| "b1" // 象
	| "b2" // 象
	| "a1" // 士
	| "a2" // 士
	| "k" // 將
	| "c1" // 砲
	| "c2" // 砲
	| "p1" // 卒
	| "p2" // 卒
	| "p3" // 卒
	| "p4" // 卒
	| "p5" // 卒

export type PieceData = {
	id: PieceId
	position: Position
}
