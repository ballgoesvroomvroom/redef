// responsible for most of the data manipulation/handling
const parser = require("./parser.js");
const databaseinst = require("../base/database.js")

const userDB = databaseinst.user; // database containing user data

class Words {
	static async upload(username, contents) {
		// contents: str - yet to be parsed
		const current = userDB.getUserField(username, "words");
		const preferences = userDB.getUserField(username, "preferences");

		const parsed = await parser.Parse(contents,
			{
				enableRegexCapturing: preferences.enableRegexCapturing
			}
		);

		let path = []; // build path to reference in current
		let prevChapter = "";
		let prevIndentLevel = 0; // indents start at 1
		for (let i = 0; i < parsed.length; i++) {
			const chapter = parsed[i];

			if (chapter.indentLevel > prevIndentLevel) {
				// guaranteed to be higher by one only, else parser should have thrown an error
				path.push(prevChapter);
				prevIndentLevel = chapter.indentLevel;
			} else if (chapter.indentLevel < prevIndentLevel) {
				// account for indents that drop by 1 or more
				for (let j = 0; j < prevIndentLevel -chapter.indentLevel; j++) {
					path.pop(); // remove last element
				}
				prevIndentLevel = chapter.indentLevel;
			}

			let pathTo = null; // store the longest valid path to chapter.header; should be a direct parent of chapter.header since everything increments by 1 indent each time only
			if (path.length === 0) {
				if (current[chapter.header] == null) {
					current[chapter.header] = [{}, {}];
				}
				pathTo = current[chapter.header];
			} else {
				let chapterExists = true;
				let selection = current[path[0]];
				for (let j = 1; j <= path.length; j++) {
					if (j === path.length) {
						// last iteration
						// chapterExists should be true too; since the j loop should have ran and no missing chapters between links
						if (!chapterExists) {
							return [false, "Internal parser error"];
						} else {
							if (selection[0][chapter.header] == null) {
								selection[0][chapter.header] = [{}, {}]; // empty data for chapter field
							}
							pathTo = selection[0][chapter.header];
						}
					} else {
						if (selection == null) {
							chapterExists = false;
							// break
						} else {
							selection = selection[0][path[j]];
						}
					}
				}
			}

			for (let j = 0; j < chapter.words.length; j++) {
				let wordObject = chapter.words[j];
				pathTo[1][wordObject.word] = [wordObject.contents, ...wordObject.keywords];
			}

			prevChapter = chapter.header;
		}

		userDB.getUserField(username, "metadata").wordsLastUpdated += 1;
		return [true, null];	
	}

	static async compare(username, content) {
		// contents: str - yet to be parsed
		// returns in the format:
		/*
		return {
			"new": [
				["[chapter 1] [geography]", [
					["word1", "..." , []] // word, content, keyword
				]]
			],
			"old": [
				// modified
				["[chapter 1] [geography]", [
					["word1", "newcontent", "newkeyword", "oldcontent", "oldkeyword"]
				]]
			}
		}
		*/
		const current = userDB.getUserField(username, "words");
		const preferences = userDB.getUserField(username, "preferences");

		const parsed = await parser.Parse(content, {
				enableRegexCapturing: preferences.enableRegexCapturing
			});

		let returnValue = {
			"new": [],
			"old": []
		}

		let path = []; // slowly build paths as traversing through (possibly) nested arrays
		let prevChapter = ""; // store previous chapter in order to build path if indentLevel increases
		let prevIndentLevel = 0; // keep track
		for (let j = 0; j < parsed.length; j++) {
			let chapter = parsed[j];

			if (chapter.indentLevel > prevIndentLevel) {
				// guaranteed to be higher by one only, else parser should have thrown an error
				path.push(prevChapter);
				prevIndentLevel = chapter.indentLevel;
			} else if (chapter.indentLevel < prevIndentLevel) {
				// account for indents that drop by 1 or more
				for (let j = 0; j < prevIndentLevel -chapter.indentLevel; j++) {
					path.pop(); // remove last element
				}
				prevIndentLevel = chapter.indentLevel;
			}

			// try to find it path exists in current; at the same time write the parsed chapter header to be displayed
			let workingPath;
			let wordData; // store the found matched data containing the words for the chapter
			let doesNotExist = true;
			if (path.length === 0) {
				// no indents
				workingPath = `[${chapter.header}]`;
				if (current[chapter.header] != null) {
					doesNotExist = false;
					wordData = current[chapter.header][1];
				}
			} else {
				workingPath = "[" +path.join("] [") +`] [${chapter.header}]`;
				let selection = current[path[0]];
				if (selection == null) {
					doesNotExist = true;
				} else {
					for (let i = 1; i <= path.length; i++) {
						if (i === path.length) {
							// last iteration; getting all the directory in path was successful
							// validate current chapter
							// i would have been out of range; append chapter.header to validate for its presence
							if (selection[0][chapter.header] != null) {
								doesNotExist = false;
								wordData = selection[0][chapter.header][1];
							}
						} else {
							selection = selection[0][path[i]];
							if (selection == null) {
								break;
							}
						}
					}

				}
			}

			// parse words (content and keywords) into return schema
			let parsedWords = []; // entire word list for the chapter
			for (let i = 0; i < chapter.words.length; i++) {
				let wordObject = chapter.words[i];
				parsedWords.push([wordObject.word, wordObject.contents, wordObject.keywords]);
			}


			if (doesNotExist) {
				// ENTIRE chapter doesnt exist; do differentiate for partial existence (some words exists within a chapter)
				// store it into the "new" key
				returnValue.new.push([workingPath, parsedWords]);
			} else {
				// chapter exists
				// determine which words are new and which words are not
				let parsedWordsForOld = [];
				let parsedWordsForNew = [];

				for (let y = 0; y < parsedWords.length; y++) {
					let word = parsedWords[y][0];
					if (wordData[word] != null) {
						// existing entry
						let oldKeywords = []; // build keywords table from database
						for (let i = 1; i < wordData[word].length; i++) {
							oldKeywords.push(wordData[word][i]);
						}
						parsedWordsForOld.push([word, parsedWords[y][1], parsedWords[y][2], wordData[word][0], oldKeywords]);
					} else {
						parsedWordsForNew.push([word, parsedWords[y][1], parsedWords[y][2]]);
					}
				}

				if (parsedWordsForOld.length > 0) {
					// some modified content
					returnValue.old.push([workingPath, parsedWordsForOld]);
				}
				if (parsedWordsForNew.length > 0) {
					returnValue.new.push([workingPath, parsedWordsForNew]);
				}
			}

			prevChapter = chapter.header;
		}

		if (returnValue.old.length === 0 && returnValue.new.length === 0) {
			return [false, "No data uploaded"];
		} else {
			return [true, returnValue];
		}
	}
}

module.exports = Words;