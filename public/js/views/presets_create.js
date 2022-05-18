import { dispAlert, fetchWordData } from "./../includes/default.js";
const SELECTED = []


// @helper functions
Object.__gID__ = 0
function hash(obj) {
	// not really a hash
	// attaches a unique id to an object, used for checkboxes
	if (!obj.__id__) {
		obj.__id__ = ++Object.__gID__;
	}
	return obj.__id__;
}

function isDictEmpty(dict) {
	for (let _ in dict) {
		return false
	}
	return true
}

function _parseChapter(chapters, chapterMap=[], obj=[]) {
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

		// do sub chapters later
		let additionalChapters = chapterData[0];
		let noMoreSubChapters = isDictEmpty(additionalChapters);
		if (!noMoreSubChapters) {
			_parseChapter(additionalChapters, [...chapterMap], obj); // shallow copy chapterMap
		}

		chapterMap.pop(); // remove leading element (chapter) since we are traversing to sibling chapter next
	}

	return obj;
}

function parseWords(wordJson) {
	// recursive
	// takes in word data (schema following the serverside database)
	/*
	 * return schema: [
	 *	[["chapter 2", "sub chapter"], "word1", "word2"]
	 * ]
	 */
	return _parseChapter(wordJson);
}

$(document).ready(function(e) {
	const $chapterContentsFrame = $("#chapter-contents-frame");
	const $titleInput = $("#title-input");

	function newChapterCard(data) {
		// data: []; [["chapter 1", "sub chapter"], "word1", "word2"]
		// same schematics as what parseWords() returns (the elements of the returned array)
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
		const $checkbox = $("<button>", {
			"class": "chapter-card-checkbox"
		});
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
		$checkbox.appendTo($right); // append check box to right side container
		$right.appendTo($front); // append right side to front container

		$front.appendTo($div); // append front container to main div

		// back
		$summary.appendTo($details); // summary tag
		$contentContainer.appendTo($details); // parent ul container to details tag, right below summary tag
		$details.appendTo($back); // append details tag to back container

		$back.appendTo($div); // append back container to main div

		let wordCheckboxes = {}; // store the checkbox (value) for the word (key) here
		// start at 1; index 0 is for the chapter headers
		for (let i = 1; i < data.length; i++) {
			const $ele = $("<div>", {
				"class": "details-content-ele"
			});

			const $span = $("<span>");
			$span.appendTo($ele);
			$span.text(data[i]);

			const $ele_checkbox = $("<div>", {
				"class": "chapter-card-checkbox",
			});
			$ele_checkbox.appendTo($ele);

			// add into dictionary
			wordCheckboxes[data[i]] = $ele_checkbox;

			// add into DOM
			$ele.appendTo($contentContainer);
		}
		$header.text("[" +data[0].join("] [") +"]"); // set header's contents

		$div.appendTo($chapterContentsFrame); // parent created main div to DOM
		return [$checkbox, wordCheckboxes];
	}

	// hover events for selection
	// use $(document) to ensure events get binded to dynamically created elements such as by newChapterCard()
	$(document).on({
		mouseenter: function(e) {
			// add -hover class on checkbox if checkbox does not have -activated class
			if (e.currentTarget.classList.contains("chapter-card-checkbox-activated")) {
				return; // do nothing, it is currently being selected
			} else {
				// add hover class
				e.currentTarget.classList.add("chapter-card-checkbox-hover");
			}
		},
		mouseleave: function(e) {
			// remove -hover class on checkbox if contains one
			if (e.currentTarget.classList.contains("chapter-card-checkbox-hover")) {
				e.currentTarget.classList.remove("chapter-card-checkbox-hover");
			}
		}
	}, ".chapter-card-checkbox");

	let chapterCheckboxMapping = []; // treat it like a session object; will be used to determine data which gets sent to server
	/* schematics:
	 *	chapterMapping = [["chapter 1", "sub chapter", {
	 *		"all": false, // all is toggled
	 *		"button": $checkbox
	 *		"words": {
	 *			"word1": [false, $checkbox] // [isToggled, jquery object]
	 *		}
	 *	}],
	 *	["chapter 2", {
	 *		"all": false,
	 *		...
	 *	}]
	 *	]
	 */
	const d = fetchWordData().then(d => {
		let nd = parseWords(d);
		console.log(nd);
		for (let i = 0; i < nd.length; i++) {
			const $checkboxes = newChapterCard(nd[i]); // returns [allCheckbox, {word1: checkbox, word2: checkbox, ...}]

			// build checkboxMapping element
			let mapping = [...nd[i][0], { // spread chapter path
				"all": false,
				"button": $checkboxes[0],
				"words": {}
			}];
			let mappingData = mapping[mapping.length -1] // since data is stored as a dict object in the last element of mapping

			for (let j = 1; j < nd[i].length; j++) {
				// start at 1 since index 0 of nd is the chapterPath (array)
				let word = nd[i][j];
				mappingData.words[word] = [false, $checkboxes[1][word]]; // initialisation

				$checkboxes[1][word].on("click", (e) => {
					console.log("CLICKED B")
					let state = !mappingData.words[word][0];
					mappingData.words[word][0] = state; // set state

					// styling
					if (state === true) {
						$checkboxes[1][word].removeClass("chapter-card-checkbox-hover");
						$checkboxes[1][word].addClass("chapter-card-checkbox-activated");

						// style chapter checkbox
						$checkboxes[0].removeClass("chapter-card-checkbox-hover");
						$checkboxes[0].addClass("chapter-card-checkbox-activated");
					} else {
						$checkboxes[1][word].removeClass("chapter-card-checkbox-activated");
					}

					// determine if all other words are in a shared state; if so style the chapter checkbox
					var sharedState = null;
					for (const word in mappingData.words) {
						if (sharedState == null) {
							sharedState = mappingData.words[word][0];
						} else {
							if (sharedState != mappingData.words[word][0]) {
								// different state
								sharedState = null
								break
							}
						}
					}
					if (sharedState == null) {
						// not all word checkboxes were in the same state
						// or unlogically sound but mappingData.words may be empty; loop wasn't run at all
						// some words are enabled and others are disabled
						if (mappingData.all) {
							// disable chapter checkbox
							mappingData.all = false; // set state
							// $checkboxes[0].removeClass("chapter-card-checkbox-activated"); // dont disable style since it needs to show that there are some words enabled
						}
					} else {
						// all share the same state
						if (sharedState == true && !mappingData.all) {
							// enable chapter since it is disabled; all word checkboxes ARE enabled
							$checkboxes[0].trigger("click");
						} else if (sharedState == false) {
							// everything was disabled but chapter checkbox is still enabled
							mappingData.all = true; // so click event wont negate and become false
							$checkboxes[0].trigger("click");
						}
					}
					e.stopPropagation();
				})
			}

			$checkboxes[0].on("click", (e) => {
				console.log("A")
				// disable/enable all
				let state = !mappingData.all; // state to be toggled to
				mappingData.all = state;

				if (state === true) {
					$checkboxes[0].removeClass("chapter-card-checkbox-hover");
					$checkboxes[0].addClass("chapter-card-checkbox-activated");

					for (const word in mappingData.words) {
						// set state
						mappingData.words[word][0] = true;

						// button styling
						mappingData.words[word][1].removeClass("chapter-card-checkbox-hover");
						mappingData.words[word][1].addClass("chapter-card-checkbox-activated");
					}
				} else {
					// toggle off
					$checkboxes[0].removeClass("chapter-card-checkbox-activated");

					for (const word in mappingData.words) {
						// set state
						mappingData.words[word][0] = false;

						// button styling
						mappingData.words[word][1].removeClass("chapter-card-checkbox-activated");
					}
				}
			})

			// add local mapping to bigger store; chapterCheckboxMapping; to be read when submit is clicked
			chapterCheckboxMapping.push(mapping);
		}
	});

	let createButtonClicked = false;
	$("#board-createbutton").on("click", (e) => {
		// create new tests
		// validate if any checkboxes got ticked
		console.log("CLICKED");

		// debounce
		if (createButtonClicked) {
			return;
		}
		createButtonClicked = true;

		let inputtedTitle = $titleInput.val();

		if (chapterCheckboxMapping.length === 0) {
			// no mappings were added yet
			console.log("chapterCheckboxMapping.length === 0: true");
			dispAlert("Nothing selected");
			createButtonClicked = false;
			return;
		} else if (inputtedTitle.length === 0) {
			// no title given to created preset
			dispAlert("Name for preset is required");
			createButtonClicked = false;
			return;
		} else {
			// validate if there were any selections made
			let selected = []; // store selected words and chapters here
			/* schema:
			 *	selected = [
			 *		[["chapter 1", "sub chapter"], "selectedWord1", "selectedWord2"],
			 *		[["chapter 2", "sub chapter"]] // length of 1 (missing second element) represents all the words for that chapter
			 *	]
			 */
			for (let i = 0; i < chapterCheckboxMapping.length; i++) {
				let selected_ele = []; // store element of selected array here; to be pushed into selected array
				let container = chapterCheckboxMapping[i];
				let data = container[container.length -1]; // last element contains an dictionary of properties

				console.log(data);
				if (data.all == true) {
					// ensure words array contains something
					let containsSomething = false;
					for (let o in data.words) {
						containsSomething = true;
						break;
					}
					if (!containsSomething) {
						// chapter is empty; skip this chapter
						continue;
					}

					let chapter = [];
					console.log(container);
					for (let j = 0; j < container.length -1; j++) {
						// get paths of the chapters; last element of container is used for data storing - not chapters
						chapter.push(container[j]);
					}
					console.log("found chapter:", chapter)
					selected_ele = [chapter];
				} else {
					for (let word in data.words) {
						if (data.words[word][0] === true) {
							if (selected_ele.length === 0) {
								// did not fill in chapter path yet
								let chapter = [];
								console.log("container:", container);
								for (let j = 0; j < container.length -1; j++) {
									// get paths of the chapters; last element of container is used for data storing - not chapters
									chapter.push(container[j]);
								}
								console.log(chapter);
								selected_ele.push(chapter);
							}

							selected_ele.push(word);
						}
					}
				}

				if (selected_ele.length > 0) {
					// there is something; push to selected area
					selected.push(selected_ele);
				}
			}

			if (selected.length > 0) {
				console.log("selected!");
				console.log(selected);
				fetch("/api/presets/create", {
					method: "POST",
					headers: {
						"Content-Type": "application/json"
					},
					credentials: "same-origin",
					body: JSON.stringify({
						contents: {
							title: inputtedTitle,
							data: selected
						}
					})
				}).then(r => {
					console.log(r.status)
					if (r.status == 401) {
						throw new Error("Session expired; please refresh!");
					} else if (r.status == 400) {
						throw new Error("Server returned 400; try refreshing!");
					}
					return
				}).then(() => {
					// use .replace so back button will not go back to this page
					window.location.replace(`/create`);
				}).catch(err => {
					console.log(err.toString());
					dispAlert(err.toString());

					createButtonClicked = false; // reset debounce
				})
			} else {
				// do nothing since nothing was selected
				console.log("nothing selected");

				dispAlert("Nothing selected")
				createButtonClicked = false; // reset debounce
				return;
			}
		}
	})

	// for (let i = 0; i < 10; i++) {newChapterCard("[chapter 2] [gw 2]", ["tourism", "recession", "outbreak of diseases"])}
})