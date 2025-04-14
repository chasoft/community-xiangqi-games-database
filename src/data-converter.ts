import { hanVietDic } from "./han-viet-dic"

/**
 * Define an interface for the Han-Viet dictionary to allow string indexing
 */
interface HanVietDictionary {
	[key: string]: string
}

/**
 * Cast the hanVietDic to the properly typed interface
 */
const typedHanVietDic = hanVietDic as HanVietDictionary

/**
 * Stores characters that couldn't be translated for later addition to the dictionary
 */
const missingTranslations = new Set<string>()

/**
 * Converts Chinese date format to YYYY/MM/DD
 * Handles formats like "1983年4月12日", "1983年4月", "1983年"
 * If conversion fails, returns the original text
 *
 * @param dateStr Original date string in Chinese format
 * @returns Formatted date as YYYY/MM/DD or original text if conversion fails
 */
export function convertDateFormat(dateStr: string): string {
	if (!dateStr || dateStr.trim() === "") {
		return dateStr
	}

	// Pattern for full date: YYYY年MM月DD日
	const fullDatePattern = /(\d{4})年(\d{1,2})月(\d{1,2})日/
	const fullMatch = dateStr.match(fullDatePattern)
	if (fullMatch) {
		const [_, year, month, day] = fullMatch
		return `${year}/${month.padStart(2, "0")}/${day.padStart(2, "0")}`
	}

	// Pattern for year and month: YYYY年MM月
	const yearMonthPattern = /(\d{4})年(\d{1,2})月/
	const yearMonthMatch = dateStr.match(yearMonthPattern)
	if (yearMonthMatch) {
		const [_, year, month] = yearMonthMatch
		return `${year}/${month.padStart(2, "0")}`
	}

	// Pattern for year only: YYYY年
	const yearPattern = /(\d{4})年/
	const yearMatch = dateStr.match(yearPattern)
	if (yearMatch) {
		return yearMatch[1]
	}

	// If no pattern matches, return original
	return dateStr
}

/**
 * Translates Chinese text to Hán-Việt (Sino-Vietnamese)
 * Adds the translation in parentheses if the text contains Chinese characters
 * Leaves untranslated characters as is and tracks them for later addition
 * Applies proper spacing and capitalization rules
 *
 * @param text Chinese text to translate
 * @returns Text with Hán-Việt translation in parentheses, or original if no translation needed
 */
export function addHanVietTranslation(text: string): string {
	if (!text || text.trim() === "") {
		return text
	}

	// Check if the text contains Chinese characters
	// Basic pattern for Chinese characters (this is simplified, not perfect)
	const chinesePattern = /[\u4e00-\u9fff\u3400-\u4dbf]/
	if (!chinesePattern.test(text)) {
		return text // No Chinese characters found, return original
	}

	let translatedText = ""
	let needsTranslation = false
	let isFirstChar = true
	let previousChar = ""
	let previousTranslation = ""

	// We'll extract consecutive digits to handle them as a single number
	let currentNumber = ""
	let i = 0

	while (i < text.length) {
		// Check if current character is a digit
		if (/^\d$/.test(text[i])) {
			// Collect consecutive digits
			while (i < text.length && /^\d$/.test(text[i])) {
				currentNumber += text[i]
				i++
			}

			// Add the number with proper spacing
			if (translatedText.length > 0 && !translatedText.endsWith(" ")) {
				translatedText += " "
			}
			translatedText += `${currentNumber} `

			// Reset number and update tracking variables
			previousChar = currentNumber
			previousTranslation = currentNumber
			currentNumber = ""

			// Continue to next character (i is already incremented)
			continue
		}

		const char = text[i]

		if (chinesePattern.test(char)) {
			needsTranslation = true
			if (typedHanVietDic[char]) {
				let translation = typedHanVietDic[char]

				// Capitalize the first character of the translation
				if (isFirstChar) {
					translation =
						translation.charAt(0).toUpperCase() + translation.slice(1)
					isFirstChar = false
				}

				// Add translation with proper spacing
				translatedText = `${translatedText}${translation} `
				previousTranslation = translation
				previousChar = char
			} else {
				// Character not found in dictionary, keep it as is and track it
				translatedText = `${translatedText}${char} `
				missingTranslations.add(char)
				previousTranslation = char
				previousChar = char
			}
		} else {
			// Non-Chinese, non-digit characters
			// Trim the last space if there's a translation before
			if (translatedText.endsWith(" ")) {
				translatedText = translatedText.substring(0, translatedText.length - 1)
			}

			translatedText = `${translatedText}${char}`
			previousChar = char
			previousTranslation = ""

			// Reset first character flag if we encounter a sentence break
			if (".!?".includes(char)) {
				isFirstChar = true
			}

			// Add space after punctuation if needed
			if (/[,.!?;:]/.test(char)) {
				translatedText = `${translatedText} `
			}
		}

		i++
	}

	// If no translation was needed, return original
	if (!needsTranslation) {
		return text
	}

	// Return the original text with the translation in parentheses
	return `${text} (${translatedText.trim()})`
}

/**
 * Converts result text to include Vietnamese and English translations
 *
 * @param result The Chinese result text
 * @returns Formatted result with translations
 */
export function convertResultText(result: string): string {
	switch (result) {
		case "红胜":
			return "红胜 (đỏ thắng / tiên thắng)"
		case "黑胜":
			return "黑胜 (đen thắng / hậu thắng)"
		case "未知":
			return "未知 (Không rõ / unknown)"
		case "和局":
			return "和局 (hòa)"
		default:
			return result
	}
}

/**
 * Returns the list of missing translations for dictionary improvement
 *
 * @returns Array of unique characters that weren't found in the dictionary
 */
export function getMissingTranslations(): string[] {
	return Array.from(missingTranslations).sort()
}

/**
 * Apply all data conversions to a parsed game object
 *
 * @param game The parsed game data object
 * @returns The same object with converted field values
 */
/**
 * Represents a Xiangqi game with all its associated metadata and content
 */
export interface XiangqiGame {
	id?: string
	collectionName?: string
	title: string
	event: string
	dateStr: string
	eventYear?: number | null
	place: string
	redPlayer: string
	blackPlayer: string
	openingName: string
	result: string
	round: string
	redTeam: string
	blackTeam: string
	gameType: string
	author: string
	owner: string
	remarks: string
	allTextContent?: string
	movelist: string
	binit: string
	comments?: Record<string, string>

	// Allow string indexing for dynamic access to properties
	[key: string]: string | number | null | undefined | Record<string, string>
}

/**
 * Apply all data conversions to a parsed game object
 *
 * @param game The parsed game data object
 * @returns The same object with converted field values
 */
export function applyDataConversions(game: XiangqiGame): XiangqiGame {
	// Clear any previously tracked missing translations
	missingTranslations.clear()

	// Convert date format
	if (game.dateStr) {
		game.dateStr = convertDateFormat(game.dateStr)
	}

	// Convert result text
	if (game.result) {
		game.result = convertResultText(game.result)
	}

	// Clean up consecutive question marks in all string fields
	for (const field in game) {
		if (
			game[field] &&
			typeof game[field] === "string" &&
			game[field].trim() !== ""
		) {
			game[field] = removeConsecutiveQuestionMarks(game[field])
		}
	}

	// Apply Hán-Việt translations to text fields
	const textFields = [
		"title",
		"event",
		"place",
		"redPlayer",
		"blackPlayer",
		"round",
		"redTeam",
		"blackTeam",
		"gameType",
		"author",
		"owner",
		"openingName",
		"remarks"
	]

	for (const field of textFields) {
		if (
			game[field] &&
			typeof game[field] === "string" &&
			game[field].trim() !== ""
		) {
			game[field] = addHanVietTranslation(game[field])
		}
	}

	// Return the modified game object
	return game
}

/**
 * Removes consecutive question marks from a string
 * This helps clean up placeholders like "???????..." in the data
 *
 * @param text The text that might contain consecutive question marks
 * @returns Cleaned string with consecutive question marks removed
 */
export function removeConsecutiveQuestionMarks(text: string): string {
	if (!text || typeof text !== "string") {
		return text
	}

	// Replace two or more consecutive question marks with empty string
	return text.replace(/\?{2,}/g, "").trim()
}
