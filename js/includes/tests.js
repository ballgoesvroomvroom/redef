// responsible for most of the data manipulation/handling for test data
const databaseinst = require("../base/database.js")

const userDB = databaseinst.user; // database containing user data

class Tests {
	static skeleton(id) {
		return { // construct test data and append to current
			id: id,
			state: 0, // 0 - not taken, 1 - taking (answers are partially filled), 2 - taken (all answers in .answers are present)
			score: 0, // stores current score
			total: 0, // total number of words to be tested in this test
			stoppedAt: 0,
			data: [],
			contents: [],
			uanswers: [], // store user answers here
			individual_scores: [], // store an array as element, [score, isCorrect]
			cache: [] // when chapters get deleted or words, cache their results here
		}
	}

	static create(username, contents) {
		// create tests with contents
		/* schema:
		 *	contents = [
		 *		[["chapter 1", "sub chapter"], "selectedWord1", "selectedWord2"],
		 *		[["chapter 2", "sub chapter"]] // length of 1 (missing second element) represents all the words for that chapter
		 *	]
		 */
		const current = this.getData(username);
		const words = userDB.getUserField(username, "words");
		const metadata = userDB.getUserField(username, "metadata");
		const preferences = userDB.getUserField(username, "preferences")

		let id = metadata.testsCreated;
		let testData = this.skeleton(id);

		for (let i = 0; i < contents.length; i++) {
			let d = contents[i];

			// validate if word exists
			let path = words[d[0][0]]; // store data retrieved from individual paths in words dictionary
			for (let j = 1; j < d[0].length; j++) {
				if (path == null) {
					// chapter don't exist; invalidate this and move on to next chapter
					break
				} else {
					path = path[0][d[0][j]];
				}
			}
			if (path == null) {
				// path was not found; invalidate this and move on to next chapter
				continue;
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
			return [false, "No new data added"]
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


		// limit userdata.tests to only contain 10 tests at most
		let testHistory = userDB.getUserField(username, "tests"); // or use 'current' variable
		for (let i = 0; i < testHistory.length -7; i++) {
			testHistory.shift();
		}

		userDB.getUserField(username, "metadata").testsLastUpdated += 1;
		return [true, id];
	}

	static getWordContents(username, chapterPath, word) {
		// chapterPath: string[]; ["chapter 1", "sub chapter"]
		// word: string: "word1"
		// will return null/undefined if chapterPath or word is invalid/doesn't exist
		if (chapterPath.length === 0) {
			return;
		}

		const d = userDB.getUserField(username, "words");

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

	static submitQuestion(username, testID, wordIndex, givenAnswer) {
		// match question
		// inputs can be trusted now
		// wordIndex - index within testData.data
		let testData = Tests.getTestFromId(username, testID)
		let pos = testData.data[wordIndex];

		// pos: [0, 0]
		let chapterPath = testData.contents[pos[0]];
		if (chapterPath == null) {
			// pos may be out of range
			return [false, "Failed to reference chapter with pos[0]: " +pos[0].toString()];
		}
		chapterPath = chapterPath[0]; // 0 index stores the chapter data

		let word = testData.contents[pos[0]][pos[1] +1]; // offset +1 since client side decremented it by 1 to accommodate for the chapter data (index 0)
		if (word == null || typeof word === "object") {
			// pos[1] = -1; invalid
			return [false, "Failed to reference word within chapter with pos[1]: " +pos[1].toString()];
		}

		let wordContents;
		if (testData.cache[testData.data[wordIndex][0]] != null && 
			testData.cache[testData.data[wordIndex][0]][testData.data[wordIndex][1]] != null) {
			// maybe word/chapter got deleted; and data got cached
			// testData.cache is a 2d array, [chapterIndexInTestData.contents: [relativeWordIndexStartingAt0]]
			wordContents = testData.cache[testData.data[wordIndex][0]][testData.data[wordIndex][1]];
		} else {
			wordContents = this.getWordContents(username, chapterPath, word);
			if (wordContents == null) {
				// probably got removed and somehow wasn't cached into testData
				return [false, "Corrupted test"];
			}
		}

		// do the actual matching and scoring

		let score = 0;
		// calculate total score (amount of keywords) at the same time (cannot just take wordContents.length -1 as it counted negated keywords which is not what we want)
		// since totalkeywords are independent to each word in a test, data wasnt stored in test data during creation of test but instead calculated at runtime
		let totalScore = 0;

		let keyword_regex_obj = {}; // store regex objects corresponding to keywords
		for (let i = 1; i < wordContents.length; i++) {
			var keyword = wordContents[i]; 

			// determine if it is a negated keyword (denoted by a tilde at the front e.g. ~negateme!)
			if (keyword[0] == "~") {
				// move on to next keyword; don't even bother testing for it
				continue;
			}

			// increment total score since current keyword isn't a negated keyword
			totalScore += 1;

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

		let isCorrect = score >= Math.floor(0.75 *totalScore); // hit 75% of the keywords to consider a correct; minus 1 to disregard actual answer stored in wordContents; >= to accommodate for totalScore = 0 (no keywords)
		// treats partially correct as wrong when calculating score, but for visual purposes, if score passed 0.5 margin, but not above correct margin, consider it as a partially correct
		let passed = score >= Math.ceil(0.5 *totalScore);

		// log first occurrence of answer into testData
		// no need to verify pos, since we've already did it with .contents array
		if (testData.state == 2) {
			// test has been done
			return [false, "Test already done"];
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

			// payload to be sent to client is returned at the end
		} else {
			// send error 400 to client
			return [false, "Question already done"];
		}

		// change state
		if (testData.state === 0) {
			userDB.getUserField(username, "metadata").testsLastUpdated += 1;
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

		return [true, {score, isCorrect, passed}]; // send data back to client
	}

	static getData(username) {
		return userDB.getUserField(username, "tests")
	}

	static getTestFromId(username, testID) {
		// return test data from testID
		const tests = userDB.getUserField(username, "tests");
		const test_l =  tests.length;

		// find testID in previous 7 tests
		for (let i = 0; i < Math.min(7, test_l); i++) {
			let testData = tests[test_l -i -1]
			if (testData.id == testID) {
				return testData;
			}
		}
	}

	static delete(username, name) {
		var success = delete userDB.getUserField(username, "tests")[name];
		return success
	}
}

module.exports = Tests;
