import { dispAlert } from "./../includes/default.js";

$(document).ready(function(e) {
	const $chapterContentsFrame = $("#chapter-contents-frame");
	const $titleInput = $("#title-input");

	function newChapterCard(data) {
		// data: []; [["chapterPathInStrRepr", blobOfJsonFileContainingDeckData], "word1", "word2"]
		// same schematics as what parseWords() returns (the elements of the returned array)
		const $div = $("<div>", {
			"class": "chapter-card"
		});
		const $header = $("<div>", {
			"class": "chapter-card-header"
		});
		const $downloadLink = $("<a>", {
			"class": "chapter-card-downloadattachment",
			"href": URL.createObjectURL(data[0][1]), // blob object of json file containing deck data
			"download": data[0][0], // path name
			"target": "_blank" // open in a new tab
		})
		const $right = $("<div>", {
			"class": "chapter-card-rightsection"
		});
		const $back = $("<div>", {
			"class": "chapter-card-back"
		});
		const $details = $("<details>");
		const $summary = $("<summary>"); // empty summary
		const $contentContainer = $("<div>", {
			"class": "details-content-container"
		});

		$header.text(data[0][0]);
		$downloadLink.text("Deck data in JSON FlashTabs v3 Schema");

		$header.appendTo($div); // append header to main div
		$downloadLink.appendTo($div);

		// back
		$summary.appendTo($details); // summary tag
		$contentContainer.appendTo($details); // parent ul container to details tag, right below summary tag
		$details.appendTo($back); // append details tag to back container

		$back.appendTo($div); // append back container to main div

		// start at 1; index 0 is for the chapter headers
		for (let i = 1; i < data.length; i++) {
			const $ele = $("<div>", {
				"class": "details-content-ele"
			});

			const $span = $("<span>");
			$span.appendTo($ele);
			$span.text(data[i]);

			// add into DOM
			$ele.appendTo($contentContainer);
		}

		$div.appendTo($chapterContentsFrame); // parent created main div to DOM
		return null; // return nothing
	}

	let retrieved_data = []; // deck data in parsed form
	const d = fetch("/api/words/flashtabs/v3", {
		method: "GET",
		headers: {
			"Content-Type": "application/json"
		},
		credentials: "same-origin"
	}).then(r => {
		if (r.status == 200) {
			return r.json();
		} else {
			return Promise.reject()
		}
	}).then(d => {
		// d is an array with children elements as deck data ready to go (already in FlashTabs v3 schema)

		// semi-parse data (push it into retrieved_data)
		for (let i = 0; i < d.length; i++) {
			let deck_data = d[i].deck

			// generate blob for file
			let file_str = JSON.stringify(d[i]);
			let file_bytes = new TextEncoder().encode(file_str);
			const blob = new Blob([file_bytes], {
				type: "application/json;charset=utf-8"
			});

			let parsed_deck_data = [
				[deck_data.name, blob],
				"No words to show -- feature is WIP"
			];
			newChapterCard(parsed_deck_data);

			retrieved_data.push(parsed_deck_data);
		}
	});

	let zipButtonClicked = false;
	$("#board-zipbutton").on("click", (e) => {
		// zip data
		console.log("CLICKED");

		// debounce
		if (zipButtonClicked) {
			return;
		}
		zipButtonClicked = true;

		// zip blobs together
		const zip = new JSZip(); // imported from html script tag declaration

		for (let i = 0; i < retrieved_data.length; i++) {
			let data = retrieved_data[i][0]; // only the first element of the container object (contains data) is important
			zip.file(data[0] +".json", data[1]); // important to declare filetype
		}

		// generate zip
		zip.generateAsync({"type": "blob"}).then(blob => {
			window.open(URL.createObjectURL(blob));

			// reset debounce
			// zipButtonClicked = false;
		})
	});
})