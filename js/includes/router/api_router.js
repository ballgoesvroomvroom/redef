const baseURL = "/api"; // base url for this router

const express = require("express");

const auth_router = require("./auth_router.js");
const views = require("../views.js");
const databaseinst = require("../../base/database.js");

const userDB = databaseinst.user;
const serverDB = databaseinst.server;

const Words = require("../words.js");
const Presets = require("../presets.js");
const Tests = require("../tests.js");

const errmsg = require("../err_msgs.js");

const router = express.Router();

router.use(auth_router.authenticated); // authenticated calls only

// for api routes; allow only application/json Content-Type for request objects
// @https://stackoverflow.com/a/46018920/12031810
router.use((req, res, next) => {
	// res.setHeader("Content-Type", "application/json"); // OR
	res.type("json"); // both works

	// req.is() returns null if body is empty (for GET & DELETE requests)
	// lowercaes "content-type" as key, not "Content-Type"
	if (req.headers["content-type"] !== "application/json") {
		res.status(400).json({"error": "Request headers 'Content-Type' must be application/json"});
	} else {
		next();
	}
})

// TOGGLE RANDOMISE
router.get("/randomise", (req, res) => {
	const p = userDB.getUserField(req.session.username, "preferences");
	p.randomOrder = !p.randomOrder;
	res.type("text");
	res.send("Randomise turned " +(p.randomOrder).toString());
})

// METADATA
router.get("/metadata", (req, res) => {
	res.json(userDB.getUserField(req.session.username, "metadata"));
})

// WORDS DATA
router.get("/words", (req, res) => {
	res.json(userDB.getUserField(req.session.username, "words"));
})

// WORDS CREATE
router.post("/words/upload", async (req, res) => {
	// validate input
	try {
		let contents = req.body.contents;

		if (contents == null) {
			throw new Error(errmsg.missing);
		} else if (typeof contents != "string") {
			throw new Error(errmsg.type);
		} else if (contents.length == 0) {
			throw new Error(errmsg.invalid);
		}

		var [success, data] = await Words.upload(req.session.username, contents);

		if (success) {
			// data is null
			res.json({}); // return back empty json object
		} else {
			// data is the error message
			throw new Error(data);
		}
	} catch (err) {
		res.statusMessage = err.message;
		res.status(400).json({"error": "Malformed input"});
	}
})

// COMPARE WORDS
router.post("/words/compare", async (req, res) => {
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

	// input validation
	try {
		let content = req.body.contents;

		if (content == null) {
			throw new Error(errmsg.missing);
		} else if (typeof content != "string") {
			throw new Error(errmsg.type);
		} else if (content.length == 0) {
			throw new Error(errmsg.invalid);
		}

		var [success, data] = await Words.compare(req.session.username, content);
		if (success) {
			// data is the return value as stated
			res.json(data);
		} else {
			// data contains the error message
			throw new Error(data);
		}
	} catch (err) {
		res.statusMessage = err.message;
		res.status(400).json({"error": "Malformed input"});
	}
})

// PRESETS DATA
router.get("/presets", (req, res) => {
	res.json(Presets.getData(req.session.username));
})

// PRESETS DELETE
router.delete("/presets/delete", (req, res) => {
	// delete presets with name passed in body.contents
	try {
		const contents = req.body.contents;
		if (contents == null) {
			throw new Error(errmsg.missing);
		} else if (typeof contents != "string") {
			throw new Error(errmsg.type);
		} else if (contents.length == 0) {
			throw new Error(errmsg.invalid);
		}

		// even if presets don't exists, silently exit (return a success code)
		var success = Presets.delete(req.session.username, contents);
		res.json({"success": success});
	} catch (err) {
		console.error(err);
		res.statusMessage = err.message;
		res.status(400).json({"error": "Malformed input"});
	}
})

// PRESETS CREATE
router.post("/presets/create", (req, res) => {
	// validate input
	try {
		let contents = req.body.contents;
		if (contents == null) {
			throw new Error(errmsg.missing);
		} else if (typeof contents != "object") {
			throw new Error(errmsg.type);
		}

		let name = contents.title;
		let data = contents.data;
		if (name == null) {
			throw new Error(errmsg.invalid);
		} else if (data == null) {
			throw new Error(errmsg.invalid);
		}

		// validate format
		// data = [[["chapter 1", "sub chapter"], "word1", "word2"], [["chapter 2", "sub chapter"], "word1", "word2"]]
		for (let i = 0; i < data.length; i++) {
			if (typeof data[i] != "object") {
				throw new Error(errmsg.invalid);
			} else if (typeof data[i][0] != "object") {
				// index of each element of contents should store chapter path hence should be arrays only
				throw new Error(errmsg.invalid);
			} else {
				for (let j = 0; j < data[i][0].length; j++) {
					// validate contents within chapter path array, should be string only
					if (typeof data[i][0][j] != "string") {
						throw new Error(errmsg.invalid);
					}
				}

				for (let k = 1; k < data[i].length; k++) {
					// words must be strings only
					if (typeof data[i][k] != "string") {
						throw new Error(errmsg.invalid);
					}
				}
			}
		}

		// format validated
		// don't check for whether if chapter exists of words etc, validated by /api/test/create when using preset itself
		Presets.create(req.session.username, name, data);
		res.status(200).end();
	} catch (err) {
		res.statusMessage = err.message;
		res.status(400).json({"error": "Malformed input"})
	}
})

// TESTS DATA
router.get("/test/get", (req, res) => {
	// get the latest tests of size n; (denoted by ?size query)
	let size = req.query.size != null ? req.query.size : 7 // default is 7
	size = Math.min(Math.max(size, 1), 7); // clamp the value between 1 and 10

	let re = []
	let tests = Tests.getData(req.session.username);
	let l = tests.length;
	for (let i = 0; i < size; i++) {
		if (i >= l) {
			break; // test data does not contain that many tests
		}
		re.push(tests[l -i -1]);
	}

	res.json(re);
})

// INDIVIDUAL TEST DATA
router.get("/test/l/:id", (req, res) => {
	let requestedID = req.params.id;

	// validate input
	try {
		if (isNaN(requestedID)) {
			// not a valid id
			throw new Error(errmsg.type)
		}
	} catch (err) {
		res.statusMessage = err.message;
		return res.status(400).json({"error": "Malformed input"});
	}

	let test = Tests.getTestFromId(req.session.username, requestedID);
	if (test == null) {
		res.status(404).json({"error": "Cannot find id in latest 7 tests - no id exists"});
	} else {
		res.json(test);
	}
})

// TEST CREATE
router.post("/test/create", (req, res) => {
	// validate input
	/* schema:
	 *	contents = [
	 *		[["chapter 1", "sub chapter"], "selectedWord1", "selectedWord2"],
	 *		[["chapter 2", "sub chapter"]] // length of 1 (missing second element) represents all the words for that chapter
	 *	]
	 */
	try {
		let contents = req.body.contents;
		if (contents == null) {
			throw new Error(errmsg.missing);
		} else if (typeof contents != "object") {
			throw new Error(errmsg.type);
		} else if (contents.length == 0) {
			throw new Error(errmsg.invalid);
		}

		for (let i = 0; i < contents.length; i++) {
			if (contents[i].length === 0) {
				throw new Error(errmsg.invalid);
			}
		}

		// validation completed
		var [success, data] = Tests.create(req.session.username, contents);

		if (success) {
			// data contains the test id
			res.json({"id": data});
		} else {
			// if success is false, data contains the error message
			throw new Error(data);
		}
	} catch (err) {
		console.error(err);
		res.statusMessage = err.message;
		res.status(400).json({"error": "Malformed input"});
	}
})

// SUBMIT QUESTION
router.post("/test/submitquestion", (req, res) => {
	// submits for a single question (single word) of the test; updates "tests" table in database
	// returns score; based on amount of keywords
	// keywordsHit out of keywords.length
	// validate input
	let testID = req.body.testid;
	let wordIndex = req.body.index; // index within testData.data
	let givenAnswer = req.body.givenAnswer;

	try {
		if (testID == null) {
			throw new Error(errmsg.missing);
		} else if (wordIndex == null) {
			throw new Error(errmsg.missing);
		} else if (givenAnswer == null) {
			throw new Error(errmsg.missing);
		} else if (typeof testID != "number") {
			throw new Error(errmsg.type);
		} else if (typeof wordIndex != "number") {
			throw new Error(errmsg.type);
		} else if (typeof givenAnswer != "string") {
			throw new Error(errmsg.type);
		} else if (givenAnswer.length == 0) {
			// reject blank answers; uanswers store empty strings to denote no answers were given
			throw new Error(errmsg.invalid);
		}

		let testData = Tests.getTestFromId(req.session.username, testID);
		if (testData == null) {
			// no testid found; invalid request
			throw new Error(errmsg.invalid);
		} else if (wordIndex < 0 || wordIndex >= testData.data.length) {
			// out of range
			throw new Error(errmsg.num_oor);
		}

		// inputs validated
		var [success, data] = Tests.submitQuestion(req.session.username, testID, wordIndex, givenAnswer);
		if (success) {
			// data is {"score": score, "isCorrect": isCorrect, "passed": passed}
			res.json(data);
		} else {
			// data holds the error message
			throw new Error(data);
		}
	} catch (err) {
		res.statusMessage = err.message;
		res.status(400).json({"error": "Malformed input"})
	}
})

module.exports = {
	baseURL, router
}