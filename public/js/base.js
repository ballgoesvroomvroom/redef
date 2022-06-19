// import { io } from "socket.io-client";
// const socket = io("http://localhost:5000", {
// 	auth: {
// 		token: "THISISMYPASSWORD"
// 	}
// })
import { dispAlert, fetchWordData, fetchTestData, LineFeedToBR } from "./includes/default.js"

const newlineMatch = /\n/gm;
const uploadWordData_SSK = "uploadWordData"; // stores parsed content returned by the server
const uploadWordDataRAW_SSK = "uploadWordDataRAW"; // stores raw file contents read by FileReader api

let testCardReference = []; // store created test cards jquery object here

$(document).ready(() => {
	const $selectors = {
		"board-tests": $("#board-tests"),

		"toadd-section": $("#toadd-section"),
		"tomodify-section": $("#tomodify-section"),
		"board-data-dataarea": $("#board-data-dataarea"),

		"board-data-upload-fileinput": $("#board-data-upload-fileinput"),

		"actualboard-header": $("#actualboard-header")
	}

	function newTestCard(data) {
		/*
		 * Creates a new test card on the test page
		 * data: [
		 *		"id": 1,
		 *		"completed": false, // if false, don't show correct/wrong or total (replace by a dash)
		 *		"correct": 0,
		 *		"wrong": 0,
		 *		"total": 2,
		 *		"contents": "[chapter 1] [biology]\n- plasma\n- nucleus"
		 */
		const div = $("<div>", {
			"class": "board-tests-card"
		});
		const left = $("<div>", {
			"class": "board-tests-card-left"
		});
		const header = $("<span>", {
			"class": "board-tests-card-words-header"
		});
		const word = $("<div>", {
			"class": "board-tests-card-words"
		});
		const right = $("<div>", {
			"class": "board-tests-card-right"
		});
		const stat_wrong = $("<div>", {
			"class": "board-tests-card-stat " + (data.completed ? "board-tests-card-wrong" : "board-tests-card-pending")
		});
		const stat_wrong_header = $("<span>", {
			"class": "board-tests-card-numdispheader"
		});
		const stat_wrong_disp = $("<span>", {
			"class": "board-tests-card-numdisp"
		});
		const stat_correct = $("<div>", {
			"class": "board-tests-card-stat " + (data.completed ? "board-tests-card-correct" : "board-tests-card-pending")
		});
		const stat_correct_header = $("<span>", {
			"class": "board-tests-card-numdispheader"
		});
		const stat_correct_disp = $("<span>", {
			"class": "board-tests-card-numdisp"
		});
		const stat_total = $("<div>", {
			"class": "board-tests-card-stat board-tests-card-total"
		});
		const stat_total_header = $("<span>", {
			"class": "board-tests-card-numdispheader"
		});
		const stat_total_disp = $("<span>", {
			"class": "board-tests-card-numdisp"
		});


		stat_wrong_header.text("[wrong]");
		stat_correct_header.text("[correct]");
		stat_total_header.text("[total]");

		stat_wrong_disp.text(data.completed ? data.wrong : "-");
		stat_correct_disp.text(data.completed ? data.correct : "-");
		stat_total_disp.text(`${data.completed ? data.correct : "-"}/${data.total}`);
		header.html(`<a href="/test/l/${data.id}" target="_blank">[.${data.id}]</a> Words:`);
		word.html(data.contents.replace(newlineMatch, "<br>"));

		// set hierarchy
		header.appendTo(left);
		word.appendTo(left);
		left.appendTo(div);

		stat_wrong_header.appendTo(stat_wrong);
		stat_wrong_disp.appendTo(stat_wrong);
		stat_wrong.appendTo(right);
		stat_correct_header.appendTo(stat_correct);
		stat_correct_disp.appendTo(stat_correct);
		stat_correct.appendTo(right);
		stat_total_header.appendTo(stat_total);
		stat_total_disp.appendTo(stat_total);
		stat_total.appendTo(right);
		right.appendTo(div);

		return div
	}

	function newDatacard(isDiff, contents) {
		/*
		 * isDiff: boolean, true if representing a difference table
		 * contents: dict
		 * {
		 *	"chapter": "[chapter 1] [geography]",
		 *  "data": [{
		 *		"word": "Tourist",
		 *		"new": {"content": "an individual", "keyword": ["key", "is"]}, // for isDiff == true
		 *		"old": {"content": "wrong answer", "keyword": ["no", "24hour"]}, // for isDiff == true
		 *		"content": "an individual", // for isDiff == false
		 *		"keyword": ["24hour", "no", "yes"] // for isDiff == false
		 *	}]
		 * }
		 */
		const $div = $("<div>", {
			"class": "datacard"
		});
		const $divHeader = $("<span>", {
			"class": "datacard-header"
		});
		const $details = $("<details>", {
			"class": "datacard-expandable"
		});
		const $summary = $("<summary>");
		const $content = $("<div>", {
			"class": "datacard-content"
		});

		$divHeader.text(contents.chapter);
		$summary.appendTo($details);
		$content.appendTo($details);
		$divHeader.appendTo($div);
		$details.appendTo($div);

		for (let dIndex = 0; dIndex < contents.data.length; dIndex++) {
			const d = contents.data[dIndex];
			const $header = $("<span>", {
				"class": "datacard-content-ele-header"
			});
			$header.text(d.word);
			$header.appendTo($content);

			if (isDiff) {
				const $container = $("<div>", {
					"class": "datacard-content-diff"
				});
				const $word_content = $("<div>", {
					"class": "datacard-content-diff-ele"
				});
				const $new_content = $("<div>", {
					"class": "datacard-content-diff-new1"
				});
				const $old_content = $("<div>", {
					"class": "datacard-content-diff-old1"
				});
				const $newc_span = $("<span>");
				const $oldc_span = $("<span>");
				$newc_span.html(LineFeedToBR(d.new.content));
				$oldc_span.html(LineFeedToBR(d.old.content));

				$newc_span.appendTo($new_content);
				$oldc_span.appendTo($old_content);
				$new_content.appendTo($word_content);
				$old_content.appendTo($word_content);
				$word_content.appendTo($container);

				const $keywords = $("<div>", {
					"class": "datacard-content-diff-ele"
				});
				const $newk = $("<div>", {
					"class": "datacard-content-diff-new2"
				});
				const $oldk = $("<div>", {
					"class": "datacard-content-diff-old2"
				});
				const $newk_span = $("<span>");
				const $oldk_span = $("<span>");
				if (d.new.keyword.length > 0) {
					$newk_span.text(d.new.keyword.join(", "));
				}
				if (d.old.keyword.length > 0) {
					$oldk_span.text(d.old.keyword.join(", "));
				}

				$newk_span.appendTo($newk);
				$oldk_span.appendTo($oldk);
				$newk.appendTo($keywords);
				$oldk.appendTo($keywords);
				$keywords.appendTo($container);

				$container.appendTo($content);
			} else {
				const $ele = $("<div>", {
					"class": "datacard-content-ele"
				});
				const $div1 = $("<div>");
				const $span1 = $("<span>");
				$span1.html(LineFeedToBR(d.content));
				$span1.appendTo($div1);

				const $div2 = $("<div>");
				const $span2 = $("<span>");
				if (d.keyword.length > 0) {
					$span2.text(d.keyword.join(", "));
				}
				$span2.appendTo($div2);

				$div1.appendTo($ele);
				$div2.appendTo($ele);

				$ele.appendTo($content);
			}
		}

		// $div.appendTo()
		return $div; // set parent outside of function
	}

	// to send data (uploaded file comparison) to dom elements to display
	function displayFileUpload(d) {
		$selectors["toadd-section"].empty();
		$selectors["tomodify-section"].empty();

		$selectors["board-data-dataarea"].removeClass("hidden");

		for (let i = 0; i < d.new.length; i++) {
			let chapter = d.new[i][0];
			let data = d.new[i][1];
			let wordsData = [];

			for (let j = 0; j < data.length; j++) {
				let ld = data[j];
				wordsData.push({
					"word": ld[0],
					"content": ld[1],
					"keyword": ld[2]
				});
			}

			const $card = newDatacard(false, {
				"chapter": chapter,
				"data": wordsData
			});
			$card.appendTo($selectors["toadd-section"]);
		}

		for (let i = 0; i < d.old.length; i++) {
			let chapter = d.old[i][0];
			let data = d.old[i][1];
			let wordsData = [];

			for (let j = 0; j < data.length; j++) {
				let ld = data[j];
				wordsData.push({
					"word": ld[0],
					"new": {
						"content": ld[1],
						"keyword": ld[2]
					},
					"old": {
						"content": ld[3],
						"keyword": ld[4]
					}
				});
			}

			const $card = newDatacard(true, {
				"chapter": chapter,
				"data": wordsData
			});
			$card.appendTo($selectors["tomodify-section"]);
		}
	}

	// hover over events for cards in test page
	// https://stackoverflow.com/a/9827114
	let current; // stores the event object passed by event listener here
	$(document).on({
		mouseenter: function(e) {
			current = e;
			e.currentTarget.classList.add("board-tests-card-expanded");

			// don't show too early; transform takes 250ms
			setTimeout(() => {
				if (current === e) {
					// ensure that scrollbar doesn't show when the card is collapsed before the 300ms wait
					e.currentTarget.children[0].children[1].classList.add("board-tests-card-words-expanded");
				}
			}, 300);
		},
		mouseleave: function(e) {
			// remove scrolling frame first
			e.currentTarget.children[0].children[1].classList.remove("board-tests-card-words-expanded");
			e.currentTarget.classList.remove("board-tests-card-expanded");

			current = null;
		}
	}, ".board-tests-card");

	let $currentOpenedPage = $("#board-tests"); // stores the jquery object of the current opened page here
	const pageMapping = {
		"board-navig-tests": [$("#board-tests"), "Tests"], // buttonid: [screen element (jquery object), texttodisplay]
		"board-navig-mastery": [$("#board-mastery"), "Mastery"],
		"board-navig-data": [$("#board-data"), "Data"]
	};
	$(".board-navigation-buttons").on("click", function(e) {
		e.target.blur(); // remove :focus styling
		let id = e.currentTarget.id;

		// find the page corresponding to the button's id
		for (const buttonId in pageMapping) {
			if (buttonId === id) {
				// found corresponding button; move on to get the page
				if (pageMapping[buttonId][0] === $currentOpenedPage) {
					// same page; do nothing
					return;
				} else {
					// different page; close current one, show new one
					$currentOpenedPage.addClass("hidden");
					pageMapping[buttonId][0].removeClass("hidden");

					// update header to the texttodisplay
					$selectors["actualboard-header"].text(pageMapping[buttonId][1]);

					// update currentOpenedPage
					$currentOpenedPage = pageMapping[buttonId][0];
				}
			}
		}
	})

	$("#board-screen-newtest").on("click", e => {
		// redirect user
		fetchWordData().then(d => {
			// check if its empty
			console.log("checking non-empty", d);
			var isEmpty = true;
			for (let chapter in d) {
				isEmpty = false; // got at least one chapter present
			}

			if (!isEmpty) {
				// current logged in user has some data
				window.location.href = "/create";
			} else {
				dispAlert("No data found; upload some in 'data' panel")
			}
		})
	})

	// get testData (history) and load into tests screen
	function displayTestHistory() {
		fetchTestData().then(d => {
			console.log("created");
			// clear out previously created elements if any
			for (let i = 0; i < testCardReference.length; i++) {
				testCardReference[i].remove();
			}
			testCardReference = [];

			for (let i = 0; i < d.length; i++) {
				let td = d[i];

				let contents = ""; // build contents string
				for (let j = 0; j < td.contents.length; j++) {
					contents += "[" +td.contents[j][0].join("] [") +"]\n";
					for (let k = 1; k < td.contents[j].length; k++) {
						contents += "- " +td.contents[j][k] +"\n";
					}
				}

				const div = newTestCard({
					"id": td.id,
					"completed": td.state == 2,
					"wrong": td.total -td.score,
					"correct": td.score,
					"total": td.total,
					"contents": contents
				});
				div.appendTo($selectors["board-tests"]);

				testCardReference.push(div);
			}
		})
	}
	displayTestHistory();

	// upload data frame
	$("#board-data-upload").on("click", e => {
		e.preventDefault();
		if (!window.FileReader) {
			return alert("filereader api not supported in this browser")
		}
		$("#board-data-upload-fileinput").trigger("click");
	})

	// upload data frame
	$selectors["board-data-upload-fileinput"].on("change", (e) => {
		var files = e.currentTarget.files
		console.log(files);
		if (files && files[0]) {
			var file = files[0];

			// validate file ends with a .txt extension
			var seg = file.name.split(".");
			if (seg[seg.length -1] !== "txt") {
				// not a .txt file
				return alert("only accepts .txt files");
			}

			var filereader = new FileReader();
			filereader.onload = function() {
				// parse contents (filereader.result) here

				fetch("/api/words/compare", {
					method: "POST",
					headers: {
						"Content-Type": "application/json"
					},
					credentials: "same-origin",
					body: JSON.stringify({
						"contents": filereader.result
					})
				}).then(r => {
					if (r.status == 200) {
						return r.json();
					} else {
						return new Promise((res) => {
							res(r.json());
						}).then(d => {
							return Promise.reject(d);
						})
					}
				}).then(d => {
					// only show upon success
					// empty out card containers
					$selectors["toadd-section"].empty();
					$selectors["tomodify-section"].empty();
					$selectors["board-data-dataarea"].removeClass("hidden");

					sessionStorage.setItem(uploadWordData_SSK, JSON.stringify(d)); // storing parsed results so on a page refresh, results will persist
					sessionStorage.setItem(uploadWordDataRAW_SSK, filereader.result); // will be sent to the server to be parsed again when submitting
					displayFileUpload(d);
				}).catch(d => {
					if (d.error != null) {
						dispAlert(d.error);
					} else {
						dispAlert("Server errored");
					}
				})
			}

			filereader.readAsText(file);
		}

		$selectors["board-data-upload-fileinput"].prop("value", ""); // reset so it triggers on the same file upload
	})

	// upload data frame
	let dataSubmitButtonClicked = false; // debounce
	$("#board-data-submitbutton").on("click", (e) => {
		// submit event
		if (!dataSubmitButtonClicked && sessionStorage.getItem(uploadWordData_SSK) != null) {
			dataSubmitButtonClicked = true;
			const d = sessionStorage.getItem(uploadWordDataRAW_SSK);
			fetch("/api/words/upload", {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					"contents": d
				})
			}).then(r => {
				if (r.status == 200) {
					return;
				} else {
					throw new Error("failed to upload data");
				}
			}).then(() => {
				// clear
				sessionStorage.removeItem(uploadWordData_SSK);
				sessionStorage.removeItem(uploadWordDataRAW_SSK);
				setTimeout(() => dataSubmitButtonClicked = false, 500); // 500ms cooldown

				// clear visuals
				$selectors["toadd-section"].empty();
				$selectors["tomodify-section"].empty();
				$selectors["board-data-dataarea"].addClass("hidden");

				// alert for visuals
				dispAlert("Upload success!")
			}).catch(err => {
				dispAlert(err.toString());
				console.error(err);
			})
		} else {
			// no file uploaded; shouldn't happen, only displayed when there is content
			return;
		}
	})

	// upload data frame
	// open/close details by clicking on card instead of arrow only
	$(document).on("click", ".datacard", e => {
		e.preventDefault();
		if (e.currentTarget.children[1].hasAttribute("open")) {
			e.currentTarget.children[1].removeAttribute("open");
		} else {
			e.currentTarget.children[1].setAttribute("open", true);
		}
	})

	// upload data frame
	// read from sessionStorage
	if (sessionStorage.getItem(uploadWordData_SSK) != null && sessionStorage.getItem(uploadWordData_SSK) != "undefined") {
		displayFileUpload(JSON.parse(sessionStorage.getItem(uploadWordData_SSK)));
	}

	// socket.on("receiveHistory", msg => {
	// 	console.log("received", msg);
	// })
	// console.log("sending socket")
	// socket.emit("getHistory");
	// console.log("sent")
})