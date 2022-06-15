import { dispAlert, fetchWordData, fetchTestDataByID, LineFeedToBR } from "./../includes/default.js";

const CORRECT_MARGIN = 0.75; // >= 75% to get a correct
const HTMLSTRIPPER_GENERALCAPTURETAG = /<(\/)?(\w*)[\w\d\(\)\s\/="':\-;.&%]*?>/gm;
const NEGATE_KEYWORDS_REGEX = /^~.+/gm;

const TRACKMATCH = [ // matches the class id for each stat-track-ele element
	"wrong", "partiallycorrect", "correct"
]
const HIGHLIGHTER = [ // different kinds of higherlighter
	["<mark class='highlighter'>", "</mark>"]
]

class Session {
	constructor(wordsObj, id) {
		this.words = wordsObj;
		this.id = id;

		this.total = wordsObj.length;
		this.prevPointer = -1; // stores the previous pointer; use to compare with .currentPointer for state changes
		this.currentPointer = -1; // .init() method will call .next() method

		this.done = false; // will be toggled true after iterating through everything

		this.score = 0; // total correct answers, determined by CORRECT_MARGIN
		this.totalscore = this.total; // calculated score

		// keep track of data
		this.inputs = [];
		this.individual_scores = []; // scores for each word
	}

	async submitAnswer(answer) {
		console.log("sent pos:", this.words[this.currentPointer].pos)
		console.log(this.id, answer)
		return fetch("/api/test/submitquestion", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			credentials: "same-origin",
			body: JSON.stringify({
				testid: this.id,
				index: this.currentPointer, // don't use .pos value within this.words
				givenAnswer: answer
			})
		}).then(r => {
			if (r.status != 200) {
				// server should return payload with .error stating the error that had occurred
				return new Promise(res => {
					res(r.json())
				}).then(d => {
					throw new Error(d.error);
				});
			} else {
				return r.json();
			}
		}).then(r => {
			console.log(r)
			return Promise.resolve(r);
		}).catch(err => {
			console.error(err);
			dispAlert(err.toString());
		})
	}

	async test(givenAnswer) {
		// returns a score for the givenAnswer matched against the right answer
		// DOES NOT increment this.currentPointer; handled in .next() method
		console.log(this.currentPointer);
		if (givenAnswer.length === 0) {
			return; // cannot submit empty strings, empty strings are used in server storage to denote unattempted questions
		}
		let data = await this.submitAnswer(givenAnswer);
		if (data == null) {
			return; // do nothing; error already displayed
		}

		let score = data.score;
		let correct = data.isCorrect;
		let passed = data.passed;

		this.score += correct; // boolean addition

		this.inputs.push(givenAnswer);
		this.individual_scores.push([score, correct, passed]);

		this.update();

		// stat track
		// 0 for wrong, 1 for partially correct, 2 for correct
		var code = 0
		if (passed) {
			code = correct ? 2 : 1
		}
		console.log(score, correct, code);
		this.addToTrack(this.currentPointer, code);

		return true; // submit success
	}
}

function parse_html(contents) {
	// strips contents within contenteditable of html tags; into readable string with linefeeds instead of br

	// add line feed for every opening div tag
	contents = contents.replace(HTMLSTRIPPER_GENERALCAPTURETAG, (sub, closing, tagName) => {
		// closing is the capture group for the forward slash, "/" in "</div>" etc
		// tagName being the actual tag name of the html element, such as "br" for captured "<br />" tag
		// or "div" for captured "<div>" tag
		return closing == null && tagName === "div" ? "\n" : ""; // return a line feed is <div> tag was matched, else strip the html tags
	})
	return contents; // don't convert to lowercase, preserve case for answers
}

function parseTestData(orderedData, contents, wordData, testCache=[]) {
	// parses test data stored on the client side, retrieve keywords for checking too
	// data from the server is valid; no need to re-validate for presence of words
	// wordData schema follows the data stored on the server database
	/* schema
	 *	orderedData = [ // order of the words
	 *		[0, 1], [1, 1],
	 *		[1, 0], [0, 0]
	 *	]
	 *	contents = [
	 *		[
	 *			["chapter 1", "sub chapter"],
	 *			"word1", "word2"
	 *		],
	 *		[
	 *			["chapter 2", "sub chapter"],
	 *			"word1", "word2"
	 *		]
	 *	]
	 *	returns [
	 *		{
	 *			"word": "word1", "contents": "answer", keywords: ["word", "1|one"],
	 *			"chapter": ["chapter 1", "sub chapter"], "chapterStrRepr": "[chapter 1] [sub chapter]",
	 *			"pos": "0-0" // chapterIndex-localWordIndex (relative to contents (bef parsing); read from orderedData when rearranging)
	 *		},
	 *		{...}
	 *	]
	 */
	let chapter_cache = []; // store chapter path in wordData and
	// the calculated .join() operation on chapterPath array here
	let re = [];
	// since data is stored chapter by chapter
	console.log(orderedData, contents, wordData, testCache)
	for (let i = 0; i < orderedData.length; i++) {
		console.log(contents, orderedData[i])
		let d = contents[orderedData[i][0]];
		console.log("|yes|")
		console.log(d);

		if (chapter_cache[orderedData[i][0]] == null) {
			// first occurrence with this chapter
			// get chapter word data
			console.log(d[0]);
			let path = wordData[d[0][0]];
			console.log(path);
			for (let j = 1; j < d[0].length; j++) {
				path = path[0][d[0][j]];
				console.log(path);
			}
			console.log(path);
			path = path[1]; // path contains the contents to the words
			console.log("hmmm")

			// get chapter string representation
			let chapterStrRepr = "[" +d[0].join("] [") +"]";

			// store it in cache
			chapter_cache[orderedData[i][0]] = [path, chapterStrRepr];
		}

		var [path, chapterStrRepr] = chapter_cache[orderedData[i][0]]; // index 0 stores the chapter index

		// d[orderedData[i][1] +1] references the current word
		// offset +1 because orderedData was stored without regarding for chapterPath array (element at index 0)
		var word = d[orderedData[i][1] +1];

		var wordcontent = path[word];
		console.log(path)
		if (wordcontent == null) {
			// refer to cache table
			// will definitely exists
			wordcontent = testCache[orderedData[i][0]][orderedData[i][1]]
		}

		let keywords = [];
		// since the 0 index stores the contents of the words, start from 1
		for (let k = 1; k < wordcontent.length; k++) {
			keywords.push(wordcontent[k])
		}

		re.push({
			"word": word,
			"contents": wordcontent[0],
			"keywords": keywords,
			"chapter": path, // uses the same array, there should no modifications to original array
			"chapterStrRepr": chapterStrRepr, // to only do join operation once
			"pos": `${orderedData[i][0]}-${orderedData[i][1]}`
		})
	}

	return re;
}

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
	console.log("CLOSEST", [...insertPos])

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

		console.log(closest)
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

$(document).ready(function(e) {
	let sessionObj;

	const $selectors = {
		"big-container": $("#big-container"),

		"play-area": $("#play-area"),
		"results-container": $("#results-container"),

		"word-chapter-header": $("#word-chapter-header"),
		"word-header-content": $("#word-header-content"),
		"answer-box": $("#answer-box"),

		"stat-track": $("#stat-track"),
		

		"stat-counter-wrong .stat-span-disp": $("#stat-counter-wrong .stat-span-disp"),
		"stat-counter-correct .stat-span-disp": $("#stat-counter-correct .stat-span-disp"),
		"stat-counter-total .stat-span-disp": $("#stat-counter-total .stat-span-disp"),

		"marking-sheet": $("#marking-sheet"),
		"answer-box": $("#answer-box"),
		"submit-button": $("#submit-button")
	}

	function newComparisonCard(chapter, word, score, givenAnswer, correctAnswer, correctAnswerKeywords, code) {
		// code represents the stat-track code
		// 0 - wrong; 1 - partially correct; 2 - correct
		const $div = $("<div>", {
			"class": "resultcard"
		});
		const $textcontainer = $("<div>", {
			"class": "resultcard-textcontainer"
		});
		const $headercontainer = $("<div>", {
			"class": "resultcard-headercontainer"
		});
		const $chapterheader = $("<div>", {
			"class": "resultcard-chapterheader"
		});
		const $wordheader = $("<div>", {
			"class": "resultcard-wordheader"
		});
		const $scorecontainer = $("<div>", {
			"class": "resultcard-scorecontainer"
		});
		const $score = $("<div>", {
			"class": "resultcard-score " + (code === 0 ? "wrong" : (code === 1 ? "partiallycorrect" : "correct"))
		});
		const $comparisontable = $("<div>", {
			"class": "resultcard-comparisontable"
		});
		const $left = $("<div>", {
			"class": "resultcard-left"
		});
		const $right = $("<div>", {
			"class": "resultcard-right"
		});

		const $headerSpan = $("<span>");
		const $wordSpan = $("<span>");
		const $scoreSpan = $("<span>");
		const $givenAnswerSpan = $("<span>");
		const $correctAnswerSpan = $("<span>");
		$headerSpan.text(chapter);
		$wordSpan.text(word);
		$scoreSpan.text(score);
		$givenAnswerSpan.html(LineFeedToBR(givenAnswer));
		$correctAnswerSpan.html(LineFeedToBR(highlight(correctAnswer, correctAnswerKeywords)));

		$headerSpan.appendTo($chapterheader);
		$wordSpan.appendTo($wordheader);
		$scoreSpan.appendTo($score);
		$givenAnswerSpan.appendTo($left);
		$correctAnswerSpan.appendTo($right);


		$chapterheader.appendTo($headercontainer);
		$wordheader.appendTo($headercontainer);
		$headercontainer.appendTo($textcontainer);

		$score.appendTo($scorecontainer);
		$scorecontainer.appendTo($textcontainer);

		$left.appendTo($comparisontable);
		$right.appendTo($comparisontable);

		$textcontainer.appendTo($div);
		$comparisontable.appendTo($div);

		$div.appendTo($selectors["results-container"])
	}

	function display(chapter, word) {
		// show new word
		console.log("displaying!", word);
		$selectors["word-chapter-header"].text(chapter);
		$selectors["word-header-content"].text(word +":");
		$selectors["answer-box"].empty(); // clear the contents of the contenteditable
	}

	function getTestID() {
		// returns id based on window.location.path
		var r = window.location.pathname.split("/");
		return parseInt(r[r.length -1]); // last element
	}

	function getTestData(id) {
		// pass in testID
		// calls fetchTestDataByID() internally
		console.log("TESTID:", id);
		return fetchTestDataByID(id).then(testData => {
			return new Promise(async res => {
				let wordData = await fetchWordData();
				res([testData, wordData]);
			})
		})
	}

	// construct session object from testdata
	getTestData(getTestID()).then(d => {
		let [testData, wordData] = d;
		console.log(testData, wordData)
		// if (testData.state == 2) {
		// 	// completed already
		// } else if (testData.state == 1) {
		// 	// partially complete
		// } else {
		if (true) {
			// state should be zero; have not start yet
			console.log("hehe")
			let re = parseTestData(testData.data, testData.contents, wordData, testData.cache);
			console.log(re);

			var startAt = 0; // default value
			var score = 0;
			var individual_scores;
			var inputs;

			// see if test was already attempted; if so, load in where last stopped; or just show endscreen if stoppedAt index is .length
			if (testData.state == 1 || testData.state == 2) {
				// load in data from testData
				// no retaking of tests
				startAt = testData.stoppedAt;
				score = testData.score;
				individual_scores = testData.individual_scores; // ele: [scores, isCorrect]
				inputs = testData.uanswers;

				// strip inputs of trailing empty strings (denotes unattempted words on the serverside)
				while (inputs[inputs.length -1].length === 0) {
					// last element is an empty string
					inputs.pop(); // remove last element
				}

				console.log("state == 1", inputs);
			}

			// construct object
			sessionObj = new Session(re, testData.id);
			sessionObj.init(startAt, score, individual_scores, inputs);
		}
	}).catch(err => {
		dispAlert(err.toString());
		console.error(err);

		$selectors["big-container"].empty();
	});

	Session.prototype.showEndScreen = function() {
		// this.done should be true
		// and this.individual_scores is populated with data

		// hide play-area
		$selectors["play-area"].addClass("hidden");

		for (let i = 0; i < this.total; i++) {
			let chapter = this.words[i].chapterStrRepr;
			let word = this.words[i].word;
			let score = `${this.individual_scores[i][0]}/${this.words[i].keywords.length}`;
			let givenAnswer = this.inputs[i];
			let correctAnswer = this.words[i].contents;
			let correctAnswerKeywords = this.words[i].keywords;

			// code for the stat visuals; 0 - wrong, 1 - partially correct, 2 - correct
			let code = 0;
			if (this.individual_scores[i][2]) {
				// not totally wrong
				code = this.individual_scores[i][1] ? 2 : 1
			}

			newComparisonCard(chapter, word, score, givenAnswer, correctAnswer, correctAnswerKeywords, code)
		}

		// make results-container visible
		$selectors["results-container"].removeClass("hidden");
	}

	Session.prototype.next = async function() {
		// go to the next word
		if (this.done) {
			// finished; stop all

			return;
		}
		console.log("called!", this.prevPointer, this.currentPointer)
		if (this.prevPointer == this.currentPointer && this.currentPointer >= this.total -1) {
			// already finished; wait for .prevPointer to 'catch up'
			this.prevPointer = -1;
			this.currentPointer = -1;
			this.done = true;

			this.showEndScreen();
		} else {
			if (this.prevPointer == this.currentPointer) {
				// move on
				this.currentPointer += 1

				this.show(false);
				display(this.words[this.currentPointer].chapterStrRepr, this.words[this.currentPointer].word);
			} else {
				// submit own answer to get back score
				console.log("testing")
				var success = await this.test(parse_html($selectors["answer-box"].html()))
				console.log("tested", success)
				if (success) {
					this.prevPointer = this.currentPointer

					this.show(true);
				}
			}
		}
	}

	Session.prototype.update = function() {
		// update visuals; called from .test() method
		$selectors["stat-counter-wrong .stat-span-disp"].text(`${this.currentPointer +1 -this.score}`)
		$selectors["stat-counter-correct .stat-span-disp"].text(`${this.score}`)
		$selectors["stat-counter-total .stat-span-disp"].text(`${this.currentPointer +1}/${this.total}`)
	}

	Session.prototype.addToTrack = function(pos, code) {
		const newTrackEle = $("<div>", {
			"class": `stat-track-ele ${TRACKMATCH[code]}`
		});

		var left = 0;
		var right = 0;
		if (pos == 0) {
			// first element
			left = 5;
		}
		if (pos == this.total -1) {
			// last element
			right = 5;
		}

		var width = 1 /this.total *100 // percentage
		newTrackEle.css({
			"top": "0",
			"left": `${width *pos}%`,
			"width": `${width}%`,
			"border-radius": `${left}px ${right}px ${right}px ${left}px`,
		});

		// add in into the DOM
		newTrackEle.appendTo($selectors["stat-track"]);
	}

	Session.prototype.show = function(toShow) {
		// show answers after submitting own answer
		// makes answer-box non-editable by removing contenteditable attribute
		if (toShow) {
			console.log("showing to show")
			$("#marking-sheet").html(
				highlight(
					this.words[this.currentPointer].contents,
					this.words[this.currentPointer].keywords
				)
			);
			$selectors["marking-sheet"].css({
				display: "block"
			});
			$selectors["answer-box"].removeAttr("contenteditable");

			// change text of button
			$selectors["submit-button"].text("Next")
		} else {
			// hide it
			console.log("hiding not show")
			$selectors["marking-sheet"].css("display", "none");
			$selectors["marking-sheet"].empty();

			$selectors["answer-box"].attr("contenteditable", "")
			// change text of button
			$selectors["submit-button"].text("Test")
		}
	}

	Session.prototype.init = function(startAt, score, individual_scores=null, inputs=null) {
		// individual_scores:
		// [[3, true], [1, false]] ## [individual_score, is_correct]
		// score = amount of is_correct in each elements of individual_scores

		// set up the writers
		$selectors["stat-track"].empty();
		$selectors["stat-counter-wrong .stat-span-disp"].text("0");
		$selectors["stat-counter-correct .stat-span-disp"].text("0");
		$selectors["stat-counter-total .stat-span-disp"].text(`0/${this.total}`);

		// set values
		this.prevPointer = startAt -1;
		this.currentPointer = startAt -1;

		this.score = score;

		if (individual_scores != null) {
			// there is some data, add them to track
			this.individual_scores = individual_scores;
			this.inputs = inputs; // they should both contain data

			for (let i = 0; i < this.individual_scores.length; i++) {
				// stat track
				// 0 for wrong, 1 for partially correct, 2 for correct
				var code = 0;
				if (this.individual_scores[i][2]) {
					code = this.individual_scores[i][1] ? 2 : 1;
				}
				this.addToTrack(i, code);
			}
		}
		this.update(); // update track stats

		console.log("calling next")
		this.next();
	}


	let isClicked = false;
	$selectors["submit-button"].on("click", async function(e) {
		if (isClicked) {
			return; // debounce
		}
		isClicked = true;

		e.target.blur();
		if (sessionObj != null) {
			await sessionObj.next();

			await setTimeout(() => isClicked = false, 100); // 100ms cooldown
		}
	});
})