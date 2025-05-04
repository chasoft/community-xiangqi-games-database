// Test script for the tournament name extraction patterns
import { extractTournamentName } from "./indexing-tournaments"

console.log("Testing extractTournamentName function with sample filenames:")

// Test cases with various formats
const testCases = [
	// Original test cases
	"1998-12-199901第14届五羊杯电视快棋赛.register.json",
	"1998年-12-199901第14届五羊杯电视快棋赛.register.json",
	"1998第14届五羊杯电视快棋赛.register.json",
	"1998年-第14届五羊杯电视快棋赛.register.json",
	'201803月18日太原市阳曲县"升龙杯"象棋赛.register.json',
	'2018年-03月18日太原市阳曲县"升龙杯"象棋赛.register.json',

	// Test cases for month-only and day-only formats
	"2012年-11月全国象棋甲级联赛.register.json",
	"2012年-11日全国象棋甲级联赛.register.json",
	"201211月全国象棋甲级联赛.register.json",
	"201211日全国象棋甲级联赛.register.json",

	// New test cases for edge cases where 月 or 日 is missing
	"1993年-09全国象棋锦标赛.register.json",
	"1993年-09-全国象棋锦标赛.register.json",
	"199309全国象棋锦标赛.register.json",
	"199309-全国象棋锦标赛.register.json"
]

for (const testCase of testCases) {
	console.log("\n")
	console.log(`Original: ${testCase}`)
	const result = extractTournamentName(testCase)
	console.log(`Extracted: ${result}`)
}

// Now run the main indexing function
console.log("\nIndexing tournaments...")
