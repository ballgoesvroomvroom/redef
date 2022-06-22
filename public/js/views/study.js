import { fetchWordData } from "./../includes/default.js"
import { Speaker } from "./../includes/speaker.js"

const NEGATE_KEYWORDS_REGEX = /^~.+/gm;
const HIGHLIGHTER = [ // different kinds of higherlighter
	["<mark class='highlighter'>", "</mark>"]
]

const BG_COLORS = [
	"#bd6d68", "#54746d", "#3b465e", "#5e537a"
]

let currentColorIndex = -1; // will increment 1 when initialising (first use)

// helper function
function highlight(contents, keywords) {
	// wrap keywords in contents with mark tags to highlight them
	// take in account that words inside keywords may contain spaces
	// also only match keywords for word boundaries

	let insertPos = []; // store numbers
	// insertPos = [[capturedString, startingIndex], ...]; schema
	let cachedWords = {}; // store encountered keywords with their regex objects here to continue search after their .lastIndex
	for (let i = 0; i < keywords.length; i++) {
		var keyword = keywords[i];

		// determine if keyword is a negate keyword
		NEGATE_KEYWORDS_REGEX.lastIndex = 0;
		var isNegate = NEGATE_KEYWORDS_REGEX.test(keyword);
		if (isNegate) {
			keyword = keyword.slice(1); // strip the leading '~' which denotes negate keywords; server shouldn't contain empty strings as keywords
			// NEGATE_KEYWORDS_REGEX should only match when there is content followed by the '~'
		}

		let regexObject = cachedWords[keyword];
		if (regexObject == null) {
			// keyword has no occurrence yet; this is the first occurrence
			regexObject = new RegExp(`\\b${keyword}\\b`, "gmi")
			cachedWords[keyword] = regexObject
		} else if (regexObject.lastIndex === 0) {
			// no more match; .lastIndex got resetted
			continue;
		}

		let match = regexObject.exec(contents); // only capture first occurrence of keyword
		if (match == null || isNegate) {
			// keyword is a negate keyword, skip one occurrence of keyword in contents to disable by setting .lastIndex (done internally when called regexObject.exec(contents))
			// so just do nothing
			continue;
		}
		insertPos.push([match[0], match.index]);
	}

	// find first index from insertPos
	let tagged = ""; // store and build up results here
	let currentPointer = 0; // current head
	while (insertPos.length > 0) {
		let closest = [contents.length +1, -1]; // set highest to the boundary; aka the furthest
		// closest = [closestDistance, indexOf]
		for (let i = 0; i < insertPos.length; i++) {
			if (insertPos[i][1] < closest[0] && insertPos[i][1] >= currentPointer) {
				// second condition is to ensure no duplicates
				closest = [insertPos[i][1], i];
			}
		}

		if (closest[1] === -1) {
			// didn't find any match; get out of loop, no other matching keywords
			break;
		} else if (closest[0] > currentPointer) {
			tagged += contents.slice(currentPointer, closest[0]);
		}

		let d = insertPos[closest[1]]; // the closest captured group
		currentPointer = d[1] +d[0].length; // set head to the end of the captured string; starting index + length of captured string

		tagged += `${HIGHLIGHTER[0][0]}${contents.slice(d[1], d[1] +d[0].length)}${HIGHLIGHTER[0][1]}`;

		// remove from insertPos
		insertPos.splice(closest[1], 1);
	}

	if (currentPointer < contents.length) {
		// not at the end
		tagged += contents.slice(currentPointer); // slice from currentPointer to the end
	}

	// replace line feeds with <br> tags
	tagged = tagged.replace(/\r?\n/gm, "<br>");

	return tagged;
}

function getNextColor() {
	// pick the next color in BG_COLORS; uses currentColorIndex
	if (++currentColorIndex >= BG_COLORS.length) {
		currentColorIndex = 0;
	}

	return BG_COLORS[currentColorIndex]
}

$(document).ready(function() {
	const $selectors = {
		"layout": $(".chapter-layout")
	}

	let masonryGridPopulated = false;

	function resizeMasonryGrid(){
		if (!masonryGridPopulated) {
			// nothing in grid yet
			return;
		}

		var elements = $selectors["layout"].children();

		var oneSpan = 30; // one span takes up 30 pixels (rough estimate of lineHeight +fontSize); doesn't matter, all elements span relative to this
		for (let i = 0; i < elements.length; i++) {
			var h = parseInt(window.getComputedStyle(elements[i].firstElementChild).height);
			// elements[i].style.gridRowEnd = "span " +(Math.ceil(h /oneSpan));
		}
	}

	function newHeader(chapterPath, bgColor) {
		// writes a new header representing the chapter path
		const $div = $("<div>", {
			"class": "chapter-header"
		});
		const $p = $("<p>", {
			"class": "chapter-content-container"
		});
		$p.text(chapterPath);
		$p.appendTo($div);

		$div.css("color", bgColor);
		$div.appendTo($selectors["layout"]);
	}

	function newWord(word, content, keyword, bgColor) {
		const $div = $("<div>", {
			"class": "chapter-content"
		});
		const $container = $("<div>", {
			"class": "chapter-content-container chapter-word"
		});
		const $header = $("<div>", {
			"class": "chapter-content-header"
		});
		const $header_span = $("<span>");
		const $tts_button = $("<button>", {
			"class": "chapter-content-tts-button"
		});
		const $tts_button_img = $("<img>", {
			"src": "/icons/audio.svg"
		});
		const $wordEle = $("<div>", {
			"class": "chapter-content-words"
		});
		const $keywordEle = $("<div>", {
			"class": "chapter-content-keywords"
		});

		$header_span.text(word);
		$wordEle.html(content);
		$keywordEle.text(keyword);

		$header_span.appendTo($header);
		$tts_button_img.appendTo($tts_button);
		$tts_button.appendTo($header);

		$header.appendTo($container);
		$wordEle.appendTo($container);
		$keywordEle.appendTo($container);

		$container.css("background-color", bgColor)
		$container.appendTo($div);

		$div.appendTo($selectors["layout"]);

		return $tts_button
	}

	function readChapter(chapterName, chapterData, bgColor, path="") {
		if (path.length === 0) {
			// uppermost chapter, no indents
			path = `[${chapterName}]`;
		} else {
			path += ` [${chapterName}]`;
		}
		newHeader(path, bgColor);

		// takes in a block of chapterData and re-run recursively till there are no more nested chapters
		var wordData = chapterData[1];
		for (let word in wordData) {
			let keywords = []; // populate array with keywords, starting from index 1
			for (let j = 1; j < wordData[word].length; j++) {
				keywords.push(wordData[word][j]);
			}

			// index 0 is the content
			const $tts_button = newWord(word, highlight(wordData[word][0], keywords), keywords.join(", "), bgColor);
			let tts_button_clicked = false; // button acts as a toggle; let declaration to make it "local"
			$tts_button.on("click", () => {
				if (tts_button_clicked) {
					Speaker.stop();
				} else {
					Speaker.speak(wordData[word][0]);
				}

				tts_button_clicked = !tts_button_clicked
			})
		}

		// parse descendant chapters if any
		for (let subChapter in chapterData[0]) {
			readChapter(subChapter, chapterData[0][subChapter], getNextColor(), path);
		}
	}

	fetchWordData().then(d => {
		var dIsEmpty = true;

		// populate list
		let i = 0;
		for (let chapter in d) {
			dIsEmpty = false;

			// select color for current chapter
			var chapterColor = getNextColor();

			readChapter(chapter, d[chapter], chapterColor);
		}

		masonryGridPopulated = !dIsEmpty;
		resizeMasonryGrid();
	})

	var masonryEvents = ["load", "resize"];
	for (let i = 0; i < masonryEvents.length; i++) {
		window.addEventListener(masonryEvents, resizeMasonryGrid);
	}
})