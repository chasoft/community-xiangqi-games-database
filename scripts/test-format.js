// Simple test script for testing the pattern extraction

// Test cases with various date formats
const testCases = [
	'201803月18日太原市阳曲县"升龙杯"象棋赛.register.json',
	'2018年-03月18日太原市阳曲县"升龙杯"象棋赛.register.json',
	"2018年-04月04日陕西蒲城第二届梨花节象棋公开赛.register.json",
	'2018年-01月27日山东郯城县第四届"勤华杯"象棋公开赛.register.json',
	'2018年-03月01日山西省朔州市首届"兴旺杯"象棋公开赛.register.json',
	// Month or day only test cases
	"2012年-11月全国象棋甲级联赛.register.json",
	"2012年-11日全国象棋甲级联赛.register.json",
	// Missing 月/日 indicator test cases
	"1993年-09全国象棋锦标赛.register.json",
	"1993年-09-全国象棋锦标赛.register.json"
]

// Test the year-month-day pattern
console.log("\nTesting Year-Month-Day Pattern:")
const yearMonthDayPattern = /^\d{4}(?:年-|年)?(\d{1,2})月(\d{1,2})日(.+)/

// Test the year-month pattern (for month-only cases)
console.log("\nTesting Year-Month Pattern:")
const yearMonthPattern = /^\d{4}(?:年-|年)?(\d{1,2})月(.+)/

// Test the year-day pattern (for day-only cases)
console.log("\nTesting Year-Day Pattern:")
const yearDayPattern = /^\d{4}(?:年-|年)?(\d{1,2})日(.+)/

// Test each case with all patterns
for (const testCase of testCases) {
	console.log(`\nTesting: ${testCase}`)
	const withoutExtension = testCase.replace(".register.json", "")

	// Try year-month-day pattern
	const monthDayMatch = withoutExtension.match(yearMonthDayPattern)
	if (monthDayMatch) {
		console.log(
			`[Year-Month-Day] Month: ${monthDayMatch[1]}, Day: ${monthDayMatch[2]}, Rest: ${monthDayMatch[3]}`
		)
	}

	// Try year-month pattern
	const monthMatch = withoutExtension.match(yearMonthPattern)
	if (monthMatch) {
		console.log(`[Year-Month] Month: ${monthMatch[1]}, Rest: ${monthMatch[2]}`)
	}

	// Try year-day pattern
	const dayMatch = withoutExtension.match(yearDayPattern)
	if (dayMatch) {
		console.log(`[Year-Day] Day: ${dayMatch[1]}, Rest: ${dayMatch[2]}`)
	}

	// Try year-numeric pattern (for missing 月/日 indicator)
	const yearNumericPattern = /^\d{4}(?:年-|年)?(\d{1,2})(?:-)?(.+)/
	const numericMatch = withoutExtension.match(yearNumericPattern)
	if (numericMatch && !monthDayMatch && !monthMatch && !dayMatch) {
		console.log(
			`[Year-Numeric] Number: ${numericMatch[1]}, Rest: ${numericMatch[2]}`
		)
	}

	if (!monthDayMatch && !monthMatch && !dayMatch && !numericMatch) {
		console.log("No match found with any pattern")
	}
}
