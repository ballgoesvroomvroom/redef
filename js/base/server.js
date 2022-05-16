const http = require("http");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser")
const express = require("express");
const sessions = require("express-session");
const io = require("socket.io");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const dotenv = require("dotenv").config();
const fs = require("fs");
const path = require("path");

const crypto = require("crypto");

// local modules
const parser = require("../includes/parser");
const DatabaseInstance = require("./database");

const database = new DatabaseInstance(path.join(process.cwd(), "database/main.json"));
const serverDatabase = new DatabaseInstance(path.join(process.cwd(), "database/server.json"))

// database.autosave = -1; // disable autosave

const PORT = 5001;
const app = express();
const httpServer = http.createServer(app);
const socketApp = io(httpServer);

const pages = {
	homepage: path.join(process.cwd(), "public/html/base.html"),
	loginpage: path.join(process.cwd(), "public/html/views/login.html"),
	register: path.join(process.cwd(), "public/html/views/register.html"),
	questions: path.join(process.cwd(), "public/html/views/questions.html"),
	create: path.join(process.cwd(), "public/html/views/create.html"),
	study: path.join(process.cwd(), "public/html/views/study.html"),
	editdata: path.join(process.cwd(), "public/html/views/edit.html"),
	"404": path.join(process.cwd(), "public/html/includes/404.html")
}

const MAX_TESTS_HISTORY = 10;

app.use(express.static("public"));
app.use(cors());

// @https://www.section.io/engineering-education/session-management-in-nodejs-using-expressjs-and-express-session/
// sessions
app.use(sessions({
	secret: process.env.SESSIONSECRET,
	saveUninitialized: true,
	cookie: {},
	resave: false
}))

// cookie parser middleware
app.use(cookieParser());

// @https://stackoverflow.com/a/27855234/12031810
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

app.use("/", (req, res, next) => {
	let username = "unknown";
	if (req.session.username) {
		username = req.session.username;
	}

	console.log(`${username} to ${req.url}`);
	next();
})

// for api routes; allow only application/json Content-Type for request objects
// @https://stackoverflow.com/a/46018920/12031810
app.use("/api/", (req, res, next) => {
	// res.setHeader("Content-Type", "application/json"); // OR
	res.type("json"); // both works
	// req.is() returns null if body is empty (for GET & DELETE requests)
	// lowercaes "content-type" as key, not "Content-Type"
	console.log(req.headers["content-type"]);
	if (req.headers["content-type"] !== "application/json") {
		res.status(400).json({"error": "request headers 'Content-Type' must be application/json"});
	} else {
		next();
	}
})

function lowLevelAuthenticate(token, callback) {
	// authenticate jwt signed token without processing any responses/requests
	// called by a higher level authenticate function that process responses/requests
	return jwt.verify(token, process.env.JWT_TOKEN, callback)
}

function authenticate(req, res, next) {
	console.log("authenticating for", req.url);
	const session = req.session;
	const token = session.token;
	if (token == null) {
		// not signed in; empty session object
		console.log("session expired")
		res.status(401);
		if (req.headers["content-type"] == "application/json") {
			res.json({"error": "missing session.auth token"});
		} else {
			res.sendFile(pages.loginpage);
		}

		return;
	}

	lowLevelAuthenticate(token, (err, payload) => {
		if (err) {
			console.log("ERROR RETURNED BY AUTHENTICATE FUNCTION;", err);
			return res.status(403).sendFile(pages.loginpage)
		};
		console.log("payload:", payload);
		req.iat = payload.iat;
		req.user = payload.user;
		console.log(req.iat);
		console.log("authenticated for route:", req.url);
		next(); // move on from middle ware
	})
}

app.get("/", authenticate, (req, res) => {
	// res.type("json"); // both works
	// res.setHeader("Content-Type", "application/json")
	// res.send(JSON.stringify({
	// 	"status": 200,
	// 	"content": null
	// }, null, 4));
	res.type("html");
	res.status(200).sendFile(pages.homepage);
})

app.get("/register", (req, res) => {
	const session = req.session;
	const token = session.token;
	if (token != null) {
		lowLevelAuthenticate(token, (err, payload) => {
			if (err) {
				// not logged in
			} else {
				// already logged in
				return res.redirect("/");
			}
		})
	} else {
		// not logged in
	}

	res.type("html");
	res.sendFile(pages.register);
})

app.get("/login", (req, res) => {
	res.redirect("/"); // redirect back to home page
})

app.get("/logout", authenticate, (req, res) => {
	req.session.destroy();
	res.redirect("/");
	// remember to call sessionStorage.clear() on the clientside
})

// app.get("/questions", authenticate, (req, res) => {
// 	res.type("html");
// 	res.sendFile(pages.questions);
// })

app.get("/edit", authenticate, (req, res) => {
	// edit test data
	res.type("html");
	res.sendFile(pages.editdata);
})

app.get("/create", authenticate, (req, res) => {
	res.type("html");
	res.sendFile(pages.create);
})

app.get("/study", authenticate, (req, res) => {
	res.type("html");
	res.sendFile(pages.study)
})

app.get("/randomise", authenticate, (req, res) => {
	const p = database.getUserField(req.session.username, "preferences");
	p.randomOrder = !p.randomOrder;
	res.type("text");
	res.send("Randomise turned " +(p.randomOrder).toString());
})

app.get("/test/g/:id", authenticate, (req, res) => {
	// fetch globally shared test
	return res.status(501).send("endpoint is still work in progress"); // yet to implement
})

app.get("/test/l/:id", authenticate, (req, res) => {
	let requestedID = req.params.id;

	const tests = database.getUserField(req.session.username, "tests");
	const test_l =  tests.length;
	// find id in previous 7 tests
	for (let i = 0; i < Math.min(7, test_l); i++) {
		let testData = tests[test_l -i -1]
		if (testData.id == requestedID) {
			res.type("html");
			return res.sendFile(pages.questions);
		}
	}

	res.type("html");
	return res.status(404).sendFile(pages["404"]);
})

// app.get("/:username/:type", authenticate, (req, res) => {
// 	console.log("getting password for", req.params.username);
// 	res.type("text");
// 	let data = database.getUserField(req.params.username, req.params.type);
// 	res.send(data);
// });

app.post("/api/login", (req, res) => {
	console.log("received endpoint", req.body)
	if (req.body.username != null && req.body.password) {
		const username = req.body.username;
		const password = req.body.password;
		if (database.doesUserExists(username)) {
			// validate password
			if (password == database.getUserField(username, "password")) {
				const token = jwt.sign({"username": username}, process.env.JWT_TOKEN);
				req.session.username = username;
				req.session.token = token; // set session id
				res.status(200).json({"Token": token})
			} else {
				res.status(401).json({"error": "invalid login credentials: password"})
			}
		} else {
			res.status(401).json({"error": "invalid login credentials: username"});
		}
	} else {
		console.log("body empty")
		res.status(401).json({"error": "empty body"})
	}
})

app.post("/api/vu", (req, res) => {
	// verify username
	let username = req.body.username;

	if (username == null) {
		return res.status(400).json({"error": "body.username missing"});
	}

	if (database.doesUserExists(username)) {
		return res.status(400).end();
	} else {
		return res.status(200).end();
	}
})

app.post("/api/vlk", (req, res) => {
	// verify license key
	let key = req.body.licenseKey;

	if (key == null) {
		return res.status(400).json({"error": "body.licenseKey missing"});
	}

	let keys = serverDatabase.getBaseField("keys");
	if (keys[key] != null && keys[key][0] === false) {
		return res.status(200).end();
	} else {
		return res.status(400).end();
	}
})

app.post("/api/register", (req, res) => {
	let username = req.body.username;
	let password = req.body.password;
	let licenseKey = req.body.licenseKey;

	if (username == null) {
		res.status(400).json({"error": "body.username missing"});
	} else if (password == null) {
		res.status(400).json({"error": "body.password missing"});
	} else if (licenseKey == null) {
		res.status(400).json({"error": "body.licenseKey missing"});
	}

	// prevent duplicated names
	if (database.doesUserExists(username)) {
		// returns true if user exists
		return res.status(400).json({"error": "username already exists"});
	}

	let keys = serverDatabase.getBaseField("keys");
	try {
		if (keys[licenseKey] != null && keys[licenseKey][0] === false) {
			// keys["licenseKeyHere"] = [isTaken, usernameRegistered]; // usernameRegistered will store an empty string if isTaken is false
			keys[licenseKey] = [true, username]

			let userData = {
				password: password,
				tests: [],
				words: {},
				presets: [],
				metadata: {
					wordsLastUpdated: 1,
					testsLastUpdated: 1,
					testsCreated: 0
				},
				preferences: {
					wordsCaseSens: false,
					chaptersCaseSens: false,
					enableRegexCapturing: true,
					randomOrder: false
				}
			}
			var success = database.createField(username, userData);
			if (success) {
				res.status(200).json({}); // return back expected empty array object
			} else {
				res.status(400).json({"error": "failed to create new entry in database"});
			}
		} else {
			// invalid license key
			res.status(401).end();
		}
	} catch {
		res.status(401).end()
	}
})

app.get("/api/words", authenticate, (req, res) => {
	// res.type("json"); // redundant; set in /api/ middleware
	// req.user from authenticate middleware, or session middleware (req.session.username)
	res.json(database.getUserField(req.session.username, "words"));
})

app.get("/api/presets", authenticate, (req, res) => {
	res.json(database.getUserField(req.session.username, "metadata"));
})

app.get("/api/metadata", authenticate, (req, res) => {
	res.json(database.getUserField(req.session.username, "metadata"));
})

app.get("/parser", (req, res) => {
	// working directory is in /HeartyBlaringSQL
	const content = fs.readFileSync("demo.txt").toString();
	const a = parser.Parse(content);
	console.log(a);
	for (const obj_i in a) {
		const obj = a[obj_i];
		console.log(obj, obj.words);
	}
	res.type("json");
	res.send(JSON.stringify(a, null, 4));
})

app.get("/secret-upload-path", authenticate, (req, res) => {
	if (req.session.username === "admin") {
		let keys = serverDatabase.getBaseField("keys");
		while (true) {
			// generate a random hex string of 30 characters; 1 byte - 2 hex characters
			var r = crypto.randomBytes(15).toString("hex");
			if (keys[r] == null) {
				// generated string doesn't exist in keys table
				keys[r] = [false, ""];
				return res.json({"key": r});
			} else {
				// duplicate; do nothing; regenerate key
			}
		}
	} else {
		return res.status(403).end();
	}
})

app.get("/secret-get-path", authenticate, (req, res) => {
	if (req.session.username === "admin") {
		let keys = serverDatabase.getBaseField("keys");
		res.type("json");
		res.json(keys);
	} else {
		return res.status(403).end();
	}
})

function findTestFromID(username, id) {
	// find id in previous 7 tests
	const tests = database.getUserField(username, "tests");
	const test_l =  tests.length;
	// find id in previous 7 tests
	for (let i = 0; i < Math.min(7, test_l); i++) {
		let testData = tests[test_l -i -1]
		if (testData.id == id) {
			return testData;
		}
	}
}

function getWordContents(username, chapterPath, word) {
	// chapterPath: string[]; ["chapter 1", "sub chapter"]
	// word: string: "word1"
	// will return null/undefined if chapterPath or word is invalid/doesn't exist
	if (chapterPath.length === 0) {
		return;
	}

	const d = database.getUserField(username, "words");

	let currentPath = d[chapterPath[0]]
	// start from 1
	for (let i = 1; i < chapterPath.length; i++) {
		if (currentPath[0][chapterPath[i]] != null) {
			currentPath = currentPath[0][chapterPath[i]]
		} else {
			return; // not a valid chapter path
		}
	}

	return currentPath[1][word];
}

app.get("/api/test/get", authenticate, (req, res) => {
	// get the latest tests of size n; (denoted by ?size query)
	let size = req.query.size != null ? req.query.size : 7 // default is 7
	size = Math.min(Math.max(size, 1), MAX_TESTS_HISTORY); // clamp the value between 1 and 10

	let re = []
	let tests = database.getUserField(req.session.username, "tests");
	let l = tests.length;
	for (let i = 0; i < size; i++) {
		if (i >= l) {
			break; // test data does not contain that many tests
		}
		re.push(tests[l -i -1]);
	}

	res.json(re);
})

app.post("/api/test/create", authenticate, (req, res) => {
	const current = database.getUserField(req.session.username, "tests");
	const metadata = database.getUserField(req.session.username, "metadata");
	const preferences = database.getUserField(req.session.username, "preferences")

	let id = metadata.testsCreated;
	try {
		// validate existence of body
		const contents = req.body.contents;
		if (contents == null) {
			throw new Error();
		}

		// validate input first
		if (contents.length === 0) {
			throw new Error();
		}
		for (let i = 0; i < contents.length; i++) {
			if (contents[i].length === 0) {
				throw new Error();
			}
		}
		let testData = { // construct test data and append to current
			"id": id,
			state: 0, // 0 - not taken, 1 - taking (answers are partially filled), 2 - taken (all answers in .answers are present)
			score: 0,
			total: 0,
			stoppedAt: 0,
			data: [],
			contents: [],
			uanswers: [], // store user answers here
			individual_scores: [], // store an array as element, [score, isCorrect]
			cache: [] // when chapters get deleted or words, cache their results here
		};

		// fill in contents and calculate total
		const words = database.getUserField(req.session.username, "words");
		/* schema:
		 *	contents = [
		 *		[["chapter 1", "sub chapter"], "selectedWord1", "selectedWord2"],
		 *		[["chapter 2", "sub chapter"]] // length of 1 (missing second element) represents all the words for that chapter
		 *	]
		 */
		for (let i = 0; i < contents.length; i++) {
			let d = contents[i];

			// validate if word exists
			let path; // store data retrieved from individual paths in words dictionary
			for (let j = 0; j < d[0].length; j++) {
				if (path == null) {
					path = words[d[0][j]];
				} else {
					path = path[0][d[0][j]];
				}
			}

			let chapterWords = path[1];
			let chapterData = []; // will be pushed into testData.contents
			// [["chapter 1", "sub chapter"], "word1", "word2"]
			// ignore if d.length === 0; not a valid input
			if (d.length === 1) {
				// test consists of all the words
				// add in chapter path

				// validate if chapter contains words
				let containsWords = false;
				for (let o in chapterWords) {
					containsWords = true;
					break;
				}
				if (!containsWords) {
					// is an empty chaper; go to next chapter
					continue;
				}

				chapterData.push(d[0]);
				for (let word in chapterWords) {
					testData.total += 1;
					chapterData.push(word);
				}

				testData.contents.push(chapterData);
			} else if (d.length >= 2) {
				// must at least contain a word
				// start from 1; since index 0 stores the chapter path
				for (let k = 1; k < d.length; k++) {
					let word = d[k];
					if (chapterWords[word] == null) {
						// not a valid word

					} else {
						testData.total += 1;
						chapterData.push(word);
					}
				}

				if (chapterData.length > 0) {
					// at least one valid word was found
					chapterData.unshift(d[0]); // add in the chapter
					testData.contents.push(chapterData);
				}
			}
		}

		// validate if process was successful
		if (testData.contents.length === 0) {
			// no new data added
			throw new Error();
		} else {
			// gather the words to give them a random order; store order in .data
			let data = [];
			for (let j = 0; j < testData.contents.length; j++) {
				// start from 1 since index 0 stores the chapterPath array
				for (let k = 1; k < testData.contents[j].length; k++) {
					data.push([j, k -1]); // make k relative to the start of the words (disregard chapterPath array)
				}
			}

			// re-arrange data
			if (preferences.randomOrder) {
				var diff = data.length; // no need to minus 1 since Math.random() will never return 1, and result is always floored
				for (let j = 0; j < Math.floor(data.length /2); j++) {
					// swap .length /2 times (floored)
					var targetIndex = Math.floor(Math.random() *diff);
					[data[j], data[targetIndex]] = [data[targetIndex], data[j]]; // using destructing assignment; https://stackoverflow.com/a/872317/12031810
				}
			}

			// push it into testData
			testData.data = data;

			// create empty arrays to store user answers
			for (let j = 0; j < data.length; j++) {
				testData.uanswers.push(""); // store empty string
			}

			// update metadata before pushing into .tests
			metadata.testsLastUpdated += 1;
			metadata.testsCreated += 1;
			current.push(testData); // verify build
		}

		res.json({"id": id});

		// limit userdata.tests to only contain 10 tests at most
		let testHistory = database.getUserField(req.session.username, "tests"); // or use 'current' variable
		for (let i = 0; i < testHistory.length -MAX_TESTS_HISTORY; i++) {
			testHistory.shift();
		}
		database.getUserField(req.session.username, "metadata").testsLastUpdated += 1;
	} catch(err) {
		console.error(err);
		res.statusMessage = "malformedinput"
		return res.status(400).json({"error": "malformed input"});
	}

})

app.post("/api/test/submitquestion", authenticate, (req, res) => {
	// submits for a single question (single word) of the test; updates "tests" table in database
	// returns score; based on amount of keywords
	// keywordsHit out of keywords.length
	let testID = req.body.testid;
	let wordIndex = req.body.index; // index within testData.data
	let givenAnswer = req.body.givenAnswer;

	if (testID == null) {
		res.statusMessage = "missing body contents";
		return res.status(400).json({"error": "missing body.testid argument"});
	} else if (wordIndex == null) {
		res.statusMessage = "missing body contents";
		return res.status(400).json({"error": "missing body.index argument"});
	} else if (givenAnswer == null) {
		res.statusMessage = "missing body contents";
		return res.status(400).json({"error": "missing body.givenAnswer argument"});
	}

	if (givenAnswer.length === 0) {
		// reject blank answers; uanswers store empty strings to denote no answers were given
		return res.status(400).json({"error": "input (givenAnswer) cannot be empty"});
	}

	let testData = findTestFromID(req.session.username, testID);
	if (testData == null) {
		// no testid found; invalid request
		return res.status(400).json({"error": "no tests found for id: " +testID.toString()});
	}
	
	// validate inputs
	if (wordIndex < 0 || wordIndex >= testData.data.length) {
		return res.status(400).json({"error": "invalid arguments, body.index, out of range"});
	}
	let pos = testData.data[wordIndex];

	// pos: [0, 0]
	let chapterPath = testData.contents[pos[0]];
	if (chapterPath == null) {
		// pos may be out of range
		return res.status(400).json({"error": "failed to reference chapter with pos[0]: " +pos[0].toString()});
	}
	chapterPath = chapterPath[0]; // 0 index stores the chapter data

	let word = testData.contents[pos[0]][pos[1] +1]; // offset +1 since client side decremented it by 1 to accommodate for the chapter data (index 0)
	if (word == null || typeof word === "object") {
		// pos[1] = -1; invalid
		return res.status(400).json({"error": "failed to reference word within chapter with pos[1]: " +pos[1].toString()});
	}

	let wordContents;
	if (testData.cache[testData.data[wordIndex][0]] != null && 
		testData.cache[testData.data[wordIndex][0]][testData.data[wordIndex][1]] != null) {
		// maybe word/chapter got deleted; and data got cached
		// testData.cache is a 2d array, [chapterIndexInTestData.contents: [relativeWordIndexStartingAt0]]
		wordContents = testData.cache[testData.data[wordIndex][0]][testData.data[wordIndex][1]];
	} else {
		wordContents = getWordContents(req.session.username, chapterPath, word);
		if (wordContents == null) {
			// probably got removed and somehow wasn't cached into testData
			return res.status(500).json({"error": "couldn't find word within chapter from test data", "data": chapterPath, "word": word});
		}
	}

	// do the actual matching and scoring
	let score = 0;
	let keyword_regex_obj = {}; // store regex objects corresponding to keywords
	for (let i = 1; i < wordContents.length; i++) {
		var keyword = wordContents[i];
		var regex = keyword_regex_obj[keyword];
		if (regex == null) {
			// first occurrence
			// wrap each keyword by a word boundary to capture whole words only
			regex = new RegExp(`\\b${keyword}\\b`, "gmi"); // use 'i' flag since case for givenAnswer is preserved whereas keywords are converted to lowercase by the uploading endpoint
			keyword_regex_obj[keyword] = regex;
		} else if (regex.lastIndex == 0) {
			// .lastIndex got resetted; no more matches found anyways
			continue;
		}

		if (regex.exec(givenAnswer) != null) {
			// preserve .lastIndex position internally if theres another match to match double occurring keywords if specified
			score += 1;
		}
	}

	let isCorrect = score > Math.floor(0.75 *(wordContents.length -1)); // hit 75% of the keywords to consider a correct; minus 1 to disregard actual answer stored in wordContents
	// treats partially correct as wrong when calculating score, but for visual purposes, if score passed 0.5 margin, but not above correct margin, consider it as a partially correct
	let passed = score >= Math.ceil(0.5 *wordContents.length);

	// log first occurrence of answer into testData
	// no need to verify pos, since we've already did it with .contents array
	if (testData.state == 2) {
		// test has been done
		res.status(400).json({"error": "test already completed"});
		return;
	}

	// check if there is an existing entry; don't store input if there is an existing entry (empty entries are "" empty strings)
	if (testData.uanswers[wordIndex].length === 0) { // no need to offset +1 to pos[1] this time since no chapter data is stored in .uanswers
		// empty string; no answers given yet
		testData.uanswers[wordIndex] = givenAnswer;

		// make additions to score (only on the first time doing the tests)
		testData.score += isCorrect;

		// update .stoppedAt value
		testData.stoppedAt += 1;

		// update .individual_scores array
		testData.individual_scores.push([score, isCorrect, passed]);

		res.json({"score": score, "isCorrect": isCorrect, "passed": passed}); // send data back to client
	} else {
		// send error 400 to client
		res.status(400).json({"error": "question already completed"});
	}

	// change state
	if (testData.state === 0) {
		database.getUserField(req.session.username, "metadata").testsLastUpdated += 1;
	}
	testData.state = 1; // state of 1 - partially done

	// check for presence of empty strings in uanswers (unsubmitted questions)
	// to determine if .state is 2 or not
	let done = true;
	for (let i = 0; i < testData.uanswers.length; i++) {
		if (testData.uanswers[i].length === 0) {
			done = false;
			break
		}

		if (!done) {
			break
		}
	}
	if (done) {
		testData.state = 2; // state of 2 - all done
	}
})

function cacheWordsToTests(username, chapterPath) {
	// caches all contents in chapter into the tests that references them
	const wordData = database.getUserField(username, "words");
	const tests = database.getUserField(username, "tests");

	let chapterIndent = chapterPath.length -1; // since chapter to cache is the last in chapterPath; e.g. ["chapter 1", "sub chapter"]
	for (let i = 0; i < tests.length; i++) {
		let testData = tests[i];

		for (let j = 0; j < testData.contents.length; j++) {
			let contents = testData.contents[j];

			if (contents[0].length > chapterIndent) {
				// contents indents are deep enough and has possiblities it contains the chapterPath
				var isMatch = true;
				for (let k = 0; k < chapterIndent; k++) {
					if (contents[0][k] != chapterPath[k]) {
						isMatch = false;
						break;
					}
				}

				if (isMatch) {
					let validPath = true;
					let d = wordData[contents[0][0]]; // contents[0] references the chapterPath, ["chapter 1", "sub chapter"]
					// start from 1 since d already contains the 0 index of chapterPath
					for (let k = 1; k < testData[0].length; k++) {
						if (d == null) {
							validPath = false; // unexpected behaviour
							console.log("path to cache doesn't seems valid within wordData; chapterPath:", contents[0])
						} else {
							d = d[0][contents[0][k]];
						}
					}
					d = d[1]; // reference dictionary that stores the words

					if (!validPath) {
						return; // unsuccessful
					}

					testData.cache[j] = []; // empty array

					// iterate through words
					// start at 1 since chapterPath takes up the 0 index whereas the words take up the remaining indices
					for (let k = 1; k < contents.length; k++) {
						// contents[k] references the words
						testData.cache[j][k] = [...d[contents[k]]] // copy the word data
					}
				}
			}
		}
	}

	return true;
}

app.get("/api/test/l/:id", authenticate, (req, res) => {
	let requestedID = req.params.id;

	let test = findTestFromID(req.session.username, requestedID);
	if (test == null) {
		return res.status(404).json({"error": "cannot find id in latest 10 tests - no id exists"});
	} else {
		return res.json(test);
	}
})

app.patch("/api/words/modify", authenticate, (req, res) => {
	// rename individual words
	let chapter = req.body.contents; // ["chapter 1", "biology"]; chapterPath
	let word = req.body.target;
	let action = req.body.action; // code to determine action; 1 - delete, 2 - rename, 3 - modify answer|keyword
	let payload = req.body.payload;
	/* payload = { // if action === 3
	 *	answer: "word1 answer",
	 *	keywords: ["keyword1", "keyword2"]
	 *	}, payload = "newWordName" // if action === 2
	 *	payload = undefined; // if action === 1; does not exists
	 */

	if (chapter == null) {
		return res.status(404).json({"error": "missing body.contents argument"});
	} else {
		// valide further
		if (typeof chapter != "object") {
			return res.status(404).json({"error": "invalid body.contents"});
		}

		// 1 dimensional array; chapter: [string, ...string[]]
		if (chapter.length === 0) {
			return res.status(404).json({"error": "invalid body.contents"});
		}
		for (let i = 0; i < chapter.length; i++) {
			if (typeof i != "string") {
				return res.status(404).json({"error": "invalid body.contents"});
			}
		}
	}

	if (word == null) {
		return res.status(404).json({"error": "missing body.target argument"});
	} else {
		if (typeof word != "string") {
			return res.status(404).json({"error": "invalid body.target"});
		}
	}

	if (action != 1 && payload == null) {
		// cannot be null if action is otherwise 
		return res.status(404).json({"error": "missing body.payload argument"});
	}

	if (action == null) {
		return res.status(404).json({"error": "missing body.action argument"});
	} else {
		if (typeof action != "number") {
			return res.status(404).json({"error": "invalid body.action"});
		}
	}

	let words = database.getUserField(req.session.username, "words");
	// does it preserve position within dictionary
	let path = words[chapter[0]];
	// start loop from 1 since first element is referenced
	for (let i = 1; i < chapter.length; i++) {
		if (path == null) {
			return res.status(404).json({"error": "body.contents: chapterPath is invalid"});
		} else {
			path = path[0][chapter[i]]
		}
	}
	path = path[1];

	// find word
	let wordData = path[word];
	if (wordData == null) {
		return res.status(404).json({"error": "invalid body.target"});
	}

	// create new entry if action is 2
	if (action === 1) {
		// remove entry
		delete path[word];
	} else if (action === 2) {
		// validate payload
		if (typeof payload != "string") {
			return res.status(404).json({"error": "invalid body.payload"});
		}

		// payload is the new word to "rename" to
		path[payload] = [...wordData]; // shallow copy data

		// remove entry
		delete path[word];
	} else if (action === 3) {
		// rewrite the contents of wordData
		if (typeof payload != "object") {
			return res.status(404).json({"error": "invalid body.payload"});
		} else {
			// ensure properties are present
			if (payload.answer == null && payload.keywords == null) {
				// payload cannot be empty; must contain either one
				return res.status(404).json({"error": "invalid body.payload"});
			}

			// reconstruct wordData
			let newWordData = [];
			if (payload.answer != null && typeof payload.answer == "string") {
				newWordData.push(payload.answer);
			} else {
				newWordData.push(wordData[0]); // use back the currently stored
			}

			if (payload.keywords != null && typeof payload.keywords == "object" && payload.keywords.length > 0) {
				for (let i = 0; i < payload.keywords.length; i++) {
					newWordData.push(payload.keywords[i]);
				}
			} else {
				for (let i = 1; i < wordData.length; i++) {
					// start at 1 since thats where keywords start
					newWordData.push(wordData[i]);
				}
			}

			delete path[word];
			path[word] = newWordData;
		}
	}

	
	return res.status(200).json({});
})

app.patch("/api/words/renamechapter", authenticate, (req, res) => {
	// rename chapter
	let chapter = req.body.contents; // ["chapter 1", "biology"]; rename "biology" chapter
	let renameTo = req.body.renameTo;

	// verify presence of words
	if (chapter == null) {
		return res.status(404).send({"error": "missing body.contents argument"});
	} else if (renameTo == null) {
		return res.status(404).send({"error": "missing body.renameTo argument"});
	} else if (chapter.length === 0) {
		return res.status(404).send({"error": "body.contents is empty"})
	}

	// carry out "renaming" operation within wordData
	const wordData = database.getUserField(req.session.username, "words");
	let path = wordData[chapter[0]];
	// start from 1 since path already contains the 0 index of chapterPath
	for (let i = 1; i < chapter.length; i++) {
		if (path == null) {
			return res.status(404).send({"error": "body.contents does not reference a valid chapter path in wordData"})
		}
		path = path[0][i];
	}
	path = path[1]; // reference the dictionary containing the words

	const tests = database.getUserField(req.session.username, "tests");
	for (let i = 0; i < tests.length; i++) {
		let testData = tests[i];
		for (let j = 0; j < testData.contents.length; j++) {
			let contents = testData.contents[j];

			let chapterPath = contents[0]; // stored as the first element
			// ["chapter 1", "sub chapter"]
			if (chapterPath.length >= chapter.length) {
				// chapterPath has the possibility to include chapter
				var isMatch = true; // whether if chapter matches chapterPath
				// e.g. chapter = ["chapter 1", "sub chapter"]
				// chapterPath = ["chapter 1", "sub chapter", "sub chapter 2.0"]
				// isMatch = true
				for (let k = 0; k < chapter.length; k++) {
					if (chapterPath[k] != chapter[k]) {
						// not a match for this content within testData
						isMatch = false;
						break;
					}
				}

				if (isMatch) {
					// modify chapterPath in the current contents to reference newly "renamed" chapter
					contents[0][chapter.length -1] = renameTo
				}
			}
		}
	}
})

app.post("/api/words/upload", authenticate, async (req, res) => {
	const current = database.getUserField(req.session.username, "words");
	const contents = req.body.contents;
	const preferences = database.getUserField(req.session.username, "preferences");

	if (contents == null) {
		return res.status(400).send({"error": "missing body.contents argument"});
	}

	const parsed = await parser.Parse(contents,
		{
			enableRegexCapturing: preferences.enableRegexCapturing
		}
	);

	let path = []; // build path to reference in current
	let prevChapter = "";
	let prevIndentLevel = 0;
	for (let i = 0; i < parsed.length; i++) {
		const chapter = parsed[i];

		if (chapter.indentLevel > prevIndentLevel) {
			// guaranteed to be higher by one only, else parser should have thrown an error
			path.push(prevChapter);
			prevIndentLevel = chapter.indentLevel;
		} else if (chapter.indentLevel < prevIndentLevel) {
			path.pop(); // remove the last element
			prevIndentLevel = chapter.indentLevel;
		}

		let pathTo = null; // store the longest valid path to chapter.header; should be a direct parent of chapter.header since everything increments by 1 indent each time only
		if (path.length === 0) {
			if (current[chapter.header] == null) {
				current[chapter.header] = [{}, {}];
			}
			pathTo = current[chapter.header];
		} else {
			let chapterExists = true;
			let selection = current[path[0]];
			for (let j = 1; j <= path.length; j++) {
				if (j === path.length) {
					// last iteration
					// chapterExists should be true too; since the j loop should have ran and no missing chapters between links
					if (!chapterExists) {
						return res.status(400).json({"error": "internal parser error"});
					} else {
						if (selection[0][chapter.header] == null) {
							selection[0][chapter.header] = [{}, {}]; // empty data for chapter field
						}
						pathTo = selection[0][chapter.header];
					}
				} else {
					if (selection == null) {
						chapterExists = false;
						// break
					} else {
						selection = selection[0][path[j]];
					}
				}
			}
		}

		for (let j = 0; j < chapter.words.length; j++) {
			let wordObject = chapter.words[j];
			pathTo[1][wordObject.word] = [wordObject.contents, ...wordObject.keywords];
		}

		prevChapter = chapter.header;
	}
	database.getUserField(req.session.username, "metadata").wordsLastUpdated += 1;
	return res.json({}); // return back empty json
})

app.post("/api/words/compare", authenticate, async (req, res) => {
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
	const current = database.getUserField(req.session.username, "words");
	const content = req.body.contents;
	const parsed = await parser.Parse(content);

	let returnValue = {
		"new": [],
		"old": []
	}

	let path = []; // slowly build paths as traversing through (possibly) nested arrays
	let prevChapter = ""; // store previous chapter in order to build path if indentLevel increases
	let prevIndentLevel = 0; // keep track
	for (let j = 0; j < parsed.length; j++) {
		let chapter = parsed[j];

		if (chapter.indentLevel > prevIndentLevel) {
			// guaranteed to be higher by one only, else parser should have thrown an error
			path.push(prevChapter);
			prevIndentLevel = chapter.indentLevel;
		} else if (chapter.indentLevel < prevIndentLevel) {
			path.pop(); // remove the last element
			prevIndentLevel = chapter.indentLevel;
		}

		// try to find it path exists in current; at the same time write the parsed chapter header to be displayed
		let workingPath;
		let wordData; // store the found matched data containing the words for the chapter
		let doesNotExist = true;
		if (path.length === 0) {
			// no indents
			workingPath = `[${chapter.header}]`;
			if (current[chapter.header] != null) {
				doesNotExist = false;
				wordData = current[chapter.header][1];
			}
		} else {
			workingPath = "[" +path.join("] [") +`] [${chapter.header}]`;
			let selection = current[path[0]];
			if (selection == null) {
				doesNotExist = true;
			} else {
				for (let i = 1; i <= path.length; i++) {
					if (i === path.length) {
						// last iteration; getting all the directory in path was successful
						// validate current chapter
						// i would have been out of range; append chapter.header to validate for its presence
						if (selection[0][chapter.header] != null) {
							doesNotExist = false;
							wordData = selection[0][chapter.header][1];
						}
					} else {
						selection = selection[0][path[i]];
						if (selection == null) {
							break;
						}
					}
				}

			}
		}

		// parse words (content and keywords) into return schema
		let parsedWords = []; // entire word list for the chapter
		for (let i = 0; i < chapter.words.length; i++) {
			let wordObject = chapter.words[i];
			parsedWords.push([wordObject.word, wordObject.contents, wordObject.keywords]);
		}


		if (doesNotExist) {
			// ENTIRE chapter doesnt exist; do differentiate for partial existence (some words exists within a chapter)
			// store it into the "new" key
			returnValue.new.push([workingPath, parsedWords]);
		} else {
			// chapter exists
			// determine which words are new and which words are not
			parsedWordsForOld = [];
			parsedWordsForNew = [];

			for (let y = 0; y < parsedWords.length; y++) {
				let word = parsedWords[y][0];
				if (wordData[word] != null) {
					// existing entry
					let oldKeywords = []; // build keywords table from database
					for (let i = 1; i < wordData[word].length; i++) {
						oldKeywords.push(wordData[word][i]);
					}
					parsedWordsForOld.push([word, parsedWords[y][1], parsedWords[y][2], wordData[word][0], oldKeywords]);
				} else {
					parsedWordsForNew.push([word, parsedWords[y][1], parsedWords[y][2]]);
				}
			}

			if (parsedWordsForOld.length > 0) {
				// some modified content
				returnValue.old.push([workingPath, parsedWordsForOld]);
			}
			if (parsedWordsForNew.length > 0) {
				returnValue.new.push([workingPath, parsedWordsForNew]);
			}
		}

		prevChapter = chapter.header;
	}

	if (returnValue.old.length === 0 && returnValue.new.length === 0) {
		res.status(400).json({"error": "no data uploaded"})
	} else {
		res.json(returnValue);
	}
})

socketApp.use((socket, next) => {
	// console.log("middleware");
	lowLevelAuthenticate(socket.handshake.auth.token)
	try {
		// console.log("working!")
		const token = socket.handshake.auth.token;
		// console.log(token, process.env.JWT_TOKEN);
		if (token == process.env.JWT_TOKEN) {
			// console.log("nice");
			next();
		} else {
			next(new Error("invalid auth tokens"));
		}
	} catch(err) {
		// console.log("hmmm, doesn't seems to be working");
		// console.log(socket.handshake.auth != null, socket.handshake.auth.token != null);
		next(new Error("auth.token missing"));
	}
})

socketApp.on("connect", socket => {
	console.log("connected server");
	socket.on("getHistory", () => {
		console.log("received by client");
		socket.emit("receiveHistory", "heres the history");
	})
	console.log("set");
})

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