const http = require("http");
const bodyParser = require("body-parser");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv").config();
const fs = require("fs");
const path = require("path");

// local modules
const DatabaseInstance = require("./database");

const database = DatabaseInstance.user;
const serverDatabase = DatabaseInstance.server;

// routers
const auth_router = require("../includes/router/auth_router.js");
const main_router = require("../includes/router/main_router.js");
const api_router = require("../includes/router/api_router.js");
const registration_router = require("../includes/router/registration_router.js");

const views = require("../includes/views.js");
// database.autosave = -1; // disable autosave

const PORT = 5001;
const app = express();
const httpServer = http.createServer(app);

app.use(express.static("public"));
app.use(cors());

// @https://stackoverflow.com/a/27855234/12031810
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

// routers
app.use((req, res, next) => {
	// disable cache for all pages
	res.set("Cache-Control", "no-cache");
	next();
});

app.use(auth_router.parseCookie); // parse cookies
app.use(auth_router.baseSession); // attach sessionobject to every route


app.use(registration_router.baseURL, registration_router.router);
app.use(auth_router.baseURL, auth_router.router);
app.use(main_router.baseURL, main_router.router);
app.use(api_router.baseURL, api_router.router);

app.use((req, res, next) => {
	// end of stack
	console.log("end of stack")
	res.status(404).sendFile(views.notFound);
})

// wip feature
// function findTestFromID(username, id) {
// 	// find id in previous 7 tests
// 	const tests = database.getUserField(username, "tests");
// 	const test_l =  tests.length;
// 	// find id in previous 7 tests
// 	for (let i = 0; i < Math.min(7, test_l); i++) {
// 		let testData = tests[test_l -i -1]
// 		if (testData.id == id) {
// 			return testData;
// 		}
// 	}
// }

// function cacheWordsToTests(username, chapterPath) {
// 	// caches all contents in chapter into the tests that references them
// 	const wordData = database.getUserField(username, "words");
// 	const tests = database.getUserField(username, "tests");

// 	let chapterIndent = chapterPath.length -1; // since chapter to cache is the last in chapterPath; e.g. ["chapter 1", "sub chapter"]
// 	for (let i = 0; i < tests.length; i++) {
// 		let testData = tests[i];

// 		for (let j = 0; j < testData.contents.length; j++) {
// 			let contents = testData.contents[j];

// 			if (contents[0].length > chapterIndent) {
// 				// contents indents are deep enough and has possiblities it contains the chapterPath
// 				var isMatch = true;
// 				for (let k = 0; k < chapterIndent; k++) {
// 					if (contents[0][k] != chapterPath[k]) {
// 						isMatch = false;
// 						break;
// 					}
// 				}

// 				if (isMatch) {
// 					let validPath = true;
// 					let d = wordData[contents[0][0]]; // contents[0] references the chapterPath, ["chapter 1", "sub chapter"]
// 					// start from 1 since d already contains the 0 index of chapterPath
// 					for (let k = 1; k < testData[0].length; k++) {
// 						if (d == null) {
// 							validPath = false; // unexpected behaviour
// 							console.log("path to cache doesn't seems valid within wordData; chapterPath:", contents[0])
// 						} else {
// 							d = d[0][contents[0][k]];
// 						}
// 					}
// 					d = d[1]; // reference dictionary that stores the words

// 					if (!validPath) {
// 						return; // unsuccessful
// 					}

// 					testData.cache[j] = []; // empty array

// 					// iterate through words
// 					// start at 1 since chapterPath takes up the 0 index whereas the words take up the remaining indices
// 					for (let k = 1; k < contents.length; k++) {
// 						// contents[k] references the words
// 						testData.cache[j][k] = [...d[contents[k]]] // copy the word data
// 					}
// 				}
// 			}
// 		}
// 	}

// 	return true;
// }

// app.patch("/api/words/modify", authenticate, (req, res) => {
// 	// rename individual words
// 	let chapter = req.body.contents; // ["chapter 1", "biology"]; chapterPath
// 	let word = req.body.target;
// 	let action = req.body.action; // code to determine action; 1 - delete, 2 - rename, 3 - modify answer|keyword
// 	let payload = req.body.payload;
// 	/* payload = { // if action === 3
// 	 *	answer: "word1 answer",
// 	 *	keywords: ["keyword1", "keyword2"]
// 	 *	}, payload = "newWordName" // if action === 2
// 	 *	payload = undefined; // if action === 1; does not exists
// 	 */

// 	if (chapter == null) {
// 		return res.status(404).json({"error": "missing body.contents argument"});
// 	} else {
// 		// valide further
// 		if (typeof chapter != "object") {
// 			return res.status(404).json({"error": "invalid body.contents"});
// 		}

// 		// 1 dimensional array; chapter: [string, ...string[]]
// 		if (chapter.length === 0) {
// 			return res.status(404).json({"error": "invalid body.contents"});
// 		}
// 		for (let i = 0; i < chapter.length; i++) {
// 			if (typeof i != "string") {
// 				return res.status(404).json({"error": "invalid body.contents"});
// 			}
// 		}
// 	}

// 	if (word == null) {
// 		return res.status(404).json({"error": "missing body.target argument"});
// 	} else {
// 		if (typeof word != "string") {
// 			return res.status(404).json({"error": "invalid body.target"});
// 		}
// 	}

// 	if (action != 1 && payload == null) {
// 		// cannot be null if action is otherwise 
// 		return res.status(404).json({"error": "missing body.payload argument"});
// 	}

// 	if (action == null) {
// 		return res.status(404).json({"error": "missing body.action argument"});
// 	} else {
// 		if (typeof action != "number") {
// 			return res.status(404).json({"error": "invalid body.action"});
// 		}
// 	}

// 	let words = database.getUserField(req.session.username, "words");
// 	// does it preserve position within dictionary
// 	let path = words[chapter[0]];
// 	// start loop from 1 since first element is referenced
// 	for (let i = 1; i < chapter.length; i++) {
// 		if (path == null) {
// 			return res.status(404).json({"error": "body.contents: chapterPath is invalid"});
// 		} else {
// 			path = path[0][chapter[i]]
// 		}
// 	}
// 	path = path[1];

// 	// find word
// 	let wordData = path[word];
// 	if (wordData == null) {
// 		return res.status(404).json({"error": "invalid body.target"});
// 	}

// 	// create new entry if action is 2
// 	if (action === 1) {
// 		// remove entry
// 		delete path[word];
// 	} else if (action === 2) {
// 		// validate payload
// 		if (typeof payload != "string") {
// 			return res.status(404).json({"error": "invalid body.payload"});
// 		}

// 		// payload is the new word to "rename" to
// 		path[payload] = [...wordData]; // shallow copy data

// 		// remove entry
// 		delete path[word];
// 	} else if (action === 3) {
// 		// rewrite the contents of wordData
// 		if (typeof payload != "object") {
// 			return res.status(404).json({"error": "invalid body.payload"});
// 		} else {
// 			// ensure properties are present
// 			if (payload.answer == null && payload.keywords == null) {
// 				// payload cannot be empty; must contain either one
// 				return res.status(404).json({"error": "invalid body.payload"});
// 			}

// 			// reconstruct wordData
// 			let newWordData = [];
// 			if (payload.answer != null && typeof payload.answer == "string") {
// 				newWordData.push(payload.answer);
// 			} else {
// 				newWordData.push(wordData[0]); // use back the currently stored
// 			}

// 			if (payload.keywords != null && typeof payload.keywords == "object" && payload.keywords.length > 0) {
// 				for (let i = 0; i < payload.keywords.length; i++) {
// 					newWordData.push(payload.keywords[i]);
// 				}
// 			} else {
// 				for (let i = 1; i < wordData.length; i++) {
// 					// start at 1 since thats where keywords start
// 					newWordData.push(wordData[i]);
// 				}
// 			}

// 			delete path[word];
// 			path[word] = newWordData;
// 		}
// 	}

	
// 	return res.status(200).json({});
// })

// app.patch("/api/words/renamechapter", authenticate, (req, res) => {
// 	// rename chapter
// 	let chapter = req.body.contents; // ["chapter 1", "biology"]; rename "biology" chapter
// 	let renameTo = req.body.renameTo;

// 	// verify presence of words
// 	if (chapter == null) {
// 		return res.status(404).send({"error": "missing body.contents argument"});
// 	} else if (renameTo == null) {
// 		return res.status(404).send({"error": "missing body.renameTo argument"});
// 	} else if (chapter.length === 0) {
// 		return res.status(404).send({"error": "body.contents is empty"})
// 	}

// 	// carry out "renaming" operation within wordData
// 	const wordData = database.getUserField(req.session.username, "words");
// 	let path = wordData[chapter[0]];
// 	// start from 1 since path already contains the 0 index of chapterPath
// 	for (let i = 1; i < chapter.length; i++) {
// 		if (path == null) {
// 			return res.status(404).send({"error": "body.contents does not reference a valid chapter path in wordData"})
// 		}
// 		path = path[0][i];
// 	}
// 	path = path[1]; // reference the dictionary containing the words

// 	const tests = database.getUserField(req.session.username, "tests");
// 	for (let i = 0; i < tests.length; i++) {
// 		let testData = tests[i];
// 		for (let j = 0; j < testData.contents.length; j++) {
// 			let contents = testData.contents[j];

// 			let chapterPath = contents[0]; // stored as the first element
// 			// ["chapter 1", "sub chapter"]
// 			if (chapterPath.length >= chapter.length) {
// 				// chapterPath has the possibility to include chapter
// 				var isMatch = true; // whether if chapter matches chapterPath
// 				// e.g. chapter = ["chapter 1", "sub chapter"]
// 				// chapterPath = ["chapter 1", "sub chapter", "sub chapter 2.0"]
// 				// isMatch = true
// 				for (let k = 0; k < chapter.length; k++) {
// 					if (chapterPath[k] != chapter[k]) {
// 						// not a match for this content within testData
// 						isMatch = false;
// 						break;
// 					}
// 				}

// 				if (isMatch) {
// 					// modify chapterPath in the current contents to reference newly "renamed" chapter
// 					contents[0][chapter.length -1] = renameTo
// 				}
// 			}
// 		}
// 	}
// })

// https://nodejs.org/api/process.html#signal-events
function exitHandler() {
	console.log("EXITING");
	const p = new Promise(res => {
		database.pushContents();
		serverDatabase.pushContents(res);
	}).then(() => {
		console.log("EXITING 2")
		process.exit();
	})
}

process.on("SIGHUP", exitHandler);
process.on("SIGINT", exitHandler);

httpServer.listen(PORT, () => {
	console.log("listening at", PORT);
})