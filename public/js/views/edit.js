import { dispAlert, fetchWordData } from "./../includes/default.js"

const session = { // use to keep track of edit sessions
	isActive: false, // will be true if currentSession contains something
	currentSession = {} // store session-related data
	
}

function isDictEmpty(dict) {
	for (let _ in dict) {
		return false
	}
	return true
}

function _parseChapter(chapters, chapterMap=[], obj=[], wordData=[]) {
	console.log("chapterMap:", chapterMap);
	for (const chapter in chapters) {
		let chapterData = chapters[chapter];
		chapterMap.push(chapter);

		let contents = chapterData[1];
		let contents_arr = [[...chapterMap]]; // map contents into here; following schema rule
		for (const w in contents) {
			contents_arr.push(w);
		}

		// push into obj
		obj.push(contents_arr);

		let wordData_contents = {};
		for (const w in contents) {
			wordData_contents[w] = [...contents[w]]; // create new array
		}

		// push into wordData
		wordData.push(wordData_contents)

		// do sub chapters later
		let additionalChapters = chapterData[0];
		let noMoreSubChapters = isDictEmpty(additionalChapters);
		if (!noMoreSubChapters) {
			_parseChapter(additionalChapters, [...chapterMap], obj, wordData); // shallow copy chapterMap
		}

		chapterMap.pop(); // remove leading element (chapter) since we are traversing to sibling chapter next
	}

	return [obj, wordData];
}

function parseWords(wordJson) {
	// recursive
	// takes in word data (schema following the serverside database)
	/*
	 * return schema: [
	 *	[["chapter 2", "sub chapter"], "word1", "word2"]
	 * ],
	 * [
	 * {
	 *	"word1": ["answer", "keyword1", "keyword2"]
	 * }
	 * ]
	 }
	 */

	return _parseChapter(wordJson);
}

$(document).ready(function(e) {
	const $selectors = {
		"board-contents": $("#board-contents"),
		"modal-dialog": $("#modal-dialog")
	}
	const optionButtons = { // id: pathToButtonImage
		"pencil": "/icons/pencil.png",
		"trash": "/icons/trash.png"
	}

	function newChapterCard(data, wordData) {
		// data: []; [["chapter 1", "sub chapter"], "word1", "word2"]
		// wordData: {}; {"word1": ["answer here", "keyword1", "keyword2"], "word2": ["ans", "keyword1"]}
		// same schematics as what parseWords() returns (the elements of the returned array)
		// returns [$chapterOptionsContainer, {"word1": $optionsContainer}]
		const $div = $("<div>", {
			"class": "chapter-card"
		});
		const $front = $("<div>", {
			"class": "chapter-card-front"
		});
		const $header = $("<div>", {
			"class": "chapter-card-header"
		});
		const $right = $("<div>", {
			"class": "chapter-card-rightsection"
		});
		const $optionscontainer = $("<div>", {
			"class": "chapter-card-optionscontainer"
		})
		const $back = $("<div>", {
			"class": "chapter-card-back"
		});
		const $details = $("<details>");
		const $summary = $("<summary>"); // empty summary
		const $contentContainer = $("<div>", {
			"class": "details-content-container"
		});

		// front
		$header.appendTo($front); // append header to front container, same parent as right side container
		$optionscontainer.appendTo($right); // append check box to right side container
		$right.appendTo($front); // append right side to front container

		$front.appendTo($div); // append front container to main div

		// back
		$summary.appendTo($details); // summary tag
		$contentContainer.appendTo($details); // parent ul container to details tag, right below summary tag
		$details.appendTo($back); // append details tag to back container

		$back.appendTo($div); // append back container to main div

		// fill in optionscontainer
		for (let i in optionButtons) {
			const $button = $("<button>", {
				"class": "unselectable chapter-card-optionbutton"
			});

			const $img = $("<img>", {
					"class": "undraggable",
				"src": optionButtons[i]
			});
			$img.appendTo($button);

			$button.appendTo($optionscontainer);
		}

		let $createdButtons = {}; // store the checkbox (value) for the word (key) here
		// start at 1; index 0 is for the chapter headers
		for (let i = 1; i < data.length; i++) {
			const $ele = $("<div>", {
				"class": "details-content-ele"
			});

			const $ele_front = $("<div>", {
				"class": "details-content-ele-front"
			});
			const $ele_back = $("<div>", {
				"class": "details-content-ele-back"
			});

			const $span = $("<span>");
			$span.appendTo($ele_front);
			$span.text(data[i]);

			const $answer_span = $("<span>");
			$answer_span.appendTo($ele_back);
			// data[i] references the word
			// answer is stored as the first element in the mapping
			$answer_span.text(wordData[data[i]][0]);
			const $keyword_span = $("<span>");
			$keyword_span.appendTo($ele_back);

			let keywordString = "";
			// wordData[data[i]]: ["answer", "keyword1", "keyword2"]
			// start from 1 as index 0 is the answer and not part of the keywords
			for (let j = 1; i < wordData[data[i]].length; j++) {
				keywordString += wordData[data[i]][j] +", ";
			}
			$keyword_span.text(keywordString.slice(0, keywordString.length -2)); // strip away last ", " added by the last iteration

			const $ele_optionscontainer = $("<div>", {
				"class": "chapter-card-optionscontainer",
			});
			$ele_optionscontainer.appendTo($ele_front);

			// fill in optionscontainer
			for (let j in optionButtons) {
				const $button = $("<button>", {
					"class": "unselectable chapter-card-optionbutton"
				});

				const $img = $("<img>", {
					"class": "undraggable",
					"src": optionButtons[j]
				});
				$img.appendTo($button);

				$button.appendTo($ele_optionscontainer);
			}

			// add the two immediate children of $ele
			$ele_front.appendTo($ele);
			$ele_back.appendTo($ele);


			// add into dictionary; to be returned outside of function
			$createdButtons[data[i]] = $ele_optionscontainer;

			// add into DOM
			$ele.appendTo($contentContainer);
		}
		$header.text("[" +data[0].join("] [") +"]"); // set header's contents

		$div.appendTo($selectors["board-contents"]); // parent created main div to DOM
		return [$optionscontainer, $createdButtons];
	}

	function buildModalForChapter(chapterData) {
		// chapterData = [["word1", "answer", "keyword1", "keyword2"]]
		for (let i = 0; i < chapterData.length; i++) {
			// $
		}
	}
	
	fetchWordData().then(d => {
		let [nd, wd] = parseWords(d);
		for (let i = 0; i < nd.length; i++) {
			const $options = newChapterCard(nd[i], wd[i]);

			// bind events to option buttons
			$($options[0].children()[0]).on("click", (e) => {
				console.log("chapter edit button pressed")
				if (session.isActive) {
					// return; there is already a session active
					return;
				}

				session.isActive = true;

				// build dialog for chapter edits
				$selectors["modal-dialog"][0].showModal();
			})
		}
	})
})
