class regexObject {
	static header = /(?!^\[).+(?=\]\s*$)/g;
	static keyword = /^[Kk]eywords?:\s?/g;
	static keyword_delimiter = /(?<!\\), ?/g;
	static word = /(?<=^!).+(?=:\s*$)/g;
	static headerIndent = /^-+ ?/g;
}

const regexsafeparsemap = {
	// a mapping of replace characters to ensure string doesnt contain any triggering insertions when performing regex to match for stuff
	// e.g. keywords match for the entire string
	[/\$/g]: "\\$",
	[/\^/g]: "\\^",
	[/\*/g]: "\\*"

}

class Parser {
	constructor() {
		this.contents = [];

		// states
		this.isKeywords = false; // will be toggled true when keywords section is reached
		this.commenting = false; // whether if parser is currently in a comment block

		// keep track of some variables
		this.prevIndentLevel = 0;
	}

	get currentChapter() {
		return this.contents.length == 0 ? null : this.contents[this.contents.length -1];
	}

	createNewChapter(chapter, indentLevel) {
		console.log(chapter, indentLevel, this.prevIndentLevel)
		if (Math.abs(indentLevel -this.prevIndentLevel) > 1) {
			// missing nested chapter; chapter indentation increased by more than 1
			throw new Error("sudden increase in indentLevel for chapter: " +chapter);
		} else if (indentLevel > 0 && this.contents.length === 0) {
			// indented (sub chapter) even though no parent (root) chapter was defined
			throw new Error("sub chapter without root chapter")
		}

		// if current chapter's current word has keywords declaration
		if (this.currentChapter != null && this.currentChapter.currentWord) {
			// get keywords data of wordobject
			// check if word has no keywords
			if (this.currentChapter.currentWord.keywords.length === 0) {
				// parse wordobject contents to be used as whole keyword
				// remove new lines, escape delimiters using a backslash so it doesn't get separated
				this.currentChapter.addContentsAsKeywords();
			}
		}

		this.contents.push(new ChapterObject(chapter, indentLevel));

		this.isKeywords = false; // reset to default
		this.prevIndentLevel = indentLevel;
	}

	isEmpty() {
		return this.contents.length == 0;
	}

	static getChapterIndent(chapterString) {
		// determines indent level for chapterString
		// returns a number, the amount of indent
		// chapterString doesn't include the square brackets syntax []
		// returns chapterIndent, chapterHeader (parsed)
		var m = chapterString.match(regexObject.headerIndent);
		if (m === null) {
			return [0, chapterString];
		} else {
			var hasSpace = m[0][m[0].length -1] == " "; // will be true if space was captured by regex

			return [m[0].length -hasSpace, chapterString.slice(m[0].length -hasSpace)]; // trim away the leading dashes to return actual header
		}
	}
}

class ChapterObject {
	constructor(header, indentLevel) {
		this.header = header;
		this.words = [];

		this.indentLevel = indentLevel;
	}

	get currentWord() {
		return this.words.length == 0 ? null : this.words[this.words.length -1]
	}

	isEmpty() {
		return this.words.length == 0;
	}

	addContentsAsKeywords() {
		// for no keywords declaration; use current word's contents as current word's keywords (wholesale)
		let parsed = this.currentWord.contents;
		parsed = parsed.replace(/\r?\n/gm, " ").replace(/,/gm, "\\,");

		this.currentWord.addKeywordsByLine(parsed);
	}

	addWords(word) {
		if (this.currentWord) {
			// get keywords data of wordobject
			// check if word has no keywords
			if (this.currentWord.keywords.length === 0) {
				// parse wordobject contents to be used as whole keyword
				// remove new lines, escape delimiters using a backslash so it doesn't get separated
				this.addContentsAsKeywords();
			}
		}
		const wordObj = new WordObject(word);

		this.words.push(wordObj);
	}
}

class WordObject {
	constructor(word) {
		this.word = word;
		this.contents = "";
		this.keywords = [];
	}

	addLine(lineContents) {
		if (this.contents.length > 0) {
			this.contents += "\n"; // preserve new lines
		}

		this.contents += lineContents;
		console.log("this.contents:", this.contents)
	}

	addKeywordsByLine(keywordString) {
		// keywordString: str, raw string before splitting
		// e.g. "xx, yy, zz, abc"
		// parse keyword to make them regex friendly; escape reserved characters such as $ etc
		let keywords = keywordString.split(regexObject.keyword_delimiter);
		for (let i = 0; i < keywords.length; i++) {
			this.keywords.push(regexSafeParse(keywords[i].toLowerCase())); // convert all of the keywords to lowercase
		}
	}
}

function regexSafeParse(s) {
	// escapes special characters; such as $
	for (const r in regexsafeparsemap) {
		s = s.replace(r, regexsafeparsemap[r]);
	}

	return s;
}

function Parse(contents) {
	/*
	 * line by line parser
	 */

	// main object
	parserObject = new Parser();

	lines = contents.split(/\r?\n/gm);
	numnberOfLines = lines.length;
	for (let lineCount = 0; lineCount < numnberOfLines; lineCount++) {
		lineContent = lines[lineCount];
		if (lineContent.length === 0) {
			if (!parserObject.isKeywords && !parserObject.isEmpty() && !parserObject.currentChapter.isEmpty()) {
				// add empty line
				parserObject.currentChapter.currentWord.addLine("");
			}
			continue
		} else if (lineContent === "===") {
			parserObject.commenting = !parserObject.commenting
		}

		if (parserObject.commenting) {
			// dont regard data as anything meaningful; comments
			continue;
		}

		regexObject.header.lastIndex = -1; // reset regex object to ensure everything gets captured
		headerMatch = regexObject.header.exec(lineContent);
		if (headerMatch !== null) {
			let [headerIndent, headerName] = Parser.getChapterIndent(headerMatch[0]);
			parserObject.createNewChapter(headerName, headerIndent)

			continue;
		}

		// reset regex objects
		regexObject.word.lastIndex = -1;
		regexObject.keyword.lastIndex = -1;

		if (!parserObject.isEmpty()) {
			// find words; must have a chapter
			wordsMatch = lineContent.match(regexObject.word);
			if (wordsMatch != null) {
				// new word
				parserObject.currentChapter.addWords(wordsMatch[0]);
				parserObject.isKeywords = false; // toggle it off, moving to new word

				continue; // no more content at this line; move on
			} else if (!parserObject.currentChapter.isEmpty()) {
				// already in a word, look for keywords definitions
				// make sure word was found for keyword definition
				keywordsMatch = lineContent.match(regexObject.keyword);
				if (keywordsMatch != null) {
					parserObject.isKeywords = true;

					lineContent = lineContent.slice(keywordsMatch[0].length); // remove the keywords header
					// don't continue, contents may be appended after the colon, e.g. `keywords: xx, yy, zz`

					if (lineContent.length === 0) {
						// continue, no data to work on, no contents appended after the colon, e.g. `keywords:`
						continue;
					}
				}
			}
		}

		// treat it as normal text either in definitions area or keywords area
		if (parserObject.isEmpty() || parserObject.currentChapter.isEmpty()) {
			// nothing added
			continue;
		}

		if (parserObject.isKeywords) {
			// add it to keywords area
			parserObject.currentChapter.currentWord.addKeywordsByLine(lineContent);
		} else {
			// normal text; add it to definitions area
			parserObject.currentChapter.currentWord.addLine(lineContent);
		}
	}

	return parserObject.contents
}

module.exports = {
	Parse
}