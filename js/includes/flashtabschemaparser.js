const schema_version = "flashtabs-3.0.0";
const databaseinst = require("../base/database.js")

const userDB = databaseinst.user; // database containing user data

function isDictEmpty(dict) {
	for (let _ in dict) {
		return false
	}
	return true
}

function _parseChapter(chapters, chapterMap=[], obj=[]) {
	// obj stores the array of deck data
	for (const chapter in chapters) {
		let chapterData = chapters[chapter];
		chapterMap.push(chapter);

		let deck_data = {
			"name": "[" +chapterMap.join("] [") +"]", // represent chapter path in string form
			"cards": []
		}

		// big container
		let deck_container = {
			"schema": schema_version,
			"deck": deck_data
		}

		let contents = chapterData[1];
		for (const w in contents) {
			deck_data.cards.push({
				"card_type": "question",
				"front": w, // entry key, "question prompt"
				"front_image": {
					"type": null,
					"type": null
				},
				"back": contents[w][0], // answer to entry
				"back_image": {
					"type": null,
					"type": null
				},
			})
		}

		// push into obj
		obj.push(deck_container);

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
	/*
	 * return schema: [
	 *	{flashtab_deckcontainer},
	 *	{flashtab_deckcontainer}
	 * ]
	 */
	return _parseChapter(wordJson);
}


// actual interface
function flashTabsParse(username) {
	// return an array of deck data
	// each element of returned array follows schema of the schema version
	const container = [];

	// get user's words
	const current = userDB.getUserField(username, "words");
	const parsed = parseWords(current);

	return parsed;
}

module.exports = flashTabsParse