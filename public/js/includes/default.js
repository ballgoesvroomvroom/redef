const localStorage_word = "words";
const localStorage_wordLastUpdated = "clientLastUpdated";

const localStorage_test = "tests";
const localStorage_testLastUpdated = "clientTestsLastUpdated";

const regex_linefeed = /\n/gm;

const $selectors = {
	"alertdialog-container": $("#alertdialog-container"),
	"alertdialog-textcontainer": $("#alertdialog-textcontainer"),
	"alertdialog-close": $("#alertdialog-close"),
	"alertdialog-text": $("#alertdialog-text"),
}

let alertID = 0;
function dispAlert(msg) {
	alertID += 1;
	let localAlertID = alertID; // capture current id for comparison later to ensure session is still the same
	$selectors["alertdialog-container"].css("display", "flex");
	$selectors["alertdialog-container"].removeClass("alertdialog-container-hidden");
	$selectors["alertdialog-text"].text(msg);

	setTimeout(() => { // hide automatically after 5000 seconds
		if (localAlertID === alertID) {
			// still the same
			$selectors["alertdialog-container"].addClass("alertdialog-container-hidden");
			setTimeout(() => {
				if ($selectors["alertdialog-container"].hasClass("alertdialog-container-hidden")) {
					// still hidden
					$selectors["alertdialog-container"].css("display", "none");
				}
			}, 250); // transition-duration is 250ms
		}
	}, 5000)
}
$selectors["alertdialog-textcontainer"].on({
	mouseenter: (e) => {
		$selectors["alertdialog-close"].removeClass("hidden");
	},
	mouseleave: (e) => {
		$selectors["alertdialog-close"].addClass("hidden");
	},
	click: (e) => {
		// dismiss alert
		$selectors["alertdialog-container"].addClass("alertdialog-container-hidden");
		setTimeout(() => {
			if ($selectors["alertdialog-container"].hasClass("alertdialog-container-hidden")) {
				// still hidden
				$selectors["alertdialog-container"].css("display", "none");
			}
		}, 250); // transition-duration is 250ms
	}
})

function fetchTestDataByID(testID) {
	// returns the testData for the specific id
	return fetch(`/api/test/l/${testID}`, {
		method: "GET",
		headers: {
			"Content-Type": "application/json"
		},
		credentials: "same-origin"
	}).then(r => {
		return [r.status, r.json()];
	}).then(d => {
		if (d[0] == 200) {
			console.log("good!", d[1])
			return d[1];
		} else {
			throw new Error(d[1].error);
		}
	}).catch(err => {
		console.error(err);
	});
}

function fetchTestData() {
	return fetch("/api/metadata", {
		method: "GET",
		headers: {
			"Content-Type": "application/json"
		},
		credentials: "same-origin"
	}).then(r => {
		console.log("immediate", r.status);
		return new Promise(async res => {
			const d = await r.json();
			res([r.status, d]);
		}); // server should return a json object regardless of status code, {"error": errmsg} even if failed
	}).then(r => {
		console.log(r);
		if (r[0] == 200) {
			console.log("all good");
			return r[1];
		} else {
			throw new Error(r[1].error);
		}
	}).catch(err => {
		console.log(err);
		return Promise.reject(-1);
	}).then(d => {
		// compare metadata.testsLastUpdated
		console.log("woah")
		const tests = JSON.parse(localStorage.getItem(localStorage_test));
		const locallyLastUpdated = localStorage.getItem(localStorage_testLastUpdated);
		console.log("boe")
		console.log(tests, locallyLastUpdated);
		if (tests == null || locallyLastUpdated == null) {
			// client side missing cache values
			return Promise.reject(d.testsLastUpdated); // pass in server side cache value
		} else {
			if (tests != null && d.testsLastUpdated == locallyLastUpdated) {
				// client side matches server side
				console.log("getTestData() cache still alive;")
				return tests;
			} else {
				// fetch updated version from server; either versions not up to match or no cache was stored (weirdly enough)
				return Promise.reject(d.wordsLastUpdated);
			}
		}
	}).catch(serverLastUpdated => {
		return fetch("/api/test/get/?size=7", {
			method: "GET",
			headers: {
				"Content-Type": "application/json"
			},
			credentials: "same-origin"
		}).then(r => {
			if (r.status == 200) {
				console.log("testdata nicely returned")
				return r.json();
			} else if (r.status == 400) {
				console.log("400 received");
				throw new Error(JSON.stringify(r.json()))
			} else {
				throw new Error("server returned", r.status)
			}
		}).then(d => {
			// cache results
			console.log(d);
			if (serverLastUpdated === -1) {
				// did not manage to get lastUpdated data from server, no point caching results
				console.log("did not get server's lastUpdated, results not cached");
			} else {
				console.log("big success!! caching results");
				localStorage.setItem(localStorage_test, JSON.stringify(d));
				localStorage.setItem(localStorage_testLastUpdated, serverLastUpdated);
			}
			return d;
		}).catch(err => {
			console.warn(err);
			return err;
		});
	});
}

function fetchWordData() {
	// compare cached value if its updated with the server
	// client-sided cache using localStorage
	return fetch("/api/metadata", {
		method: "GET",
		headers: {
			"Content-Type": "application/json"
		},
		credentials: "same-origin"
	}).then(r => {
		console.log("immediate", r.status);
		return new Promise(async res => {
			const d = await r.json();
			res([r.status, d]);
		}); // server should return a json object regardless of status code, {"error": errmsg} even if failed
	}).then(r => {
		console.log(r);
		if (r[0] == 200) {
			console.log("all good");
			return r[1];
		} else {
			throw new Error(r[1].error);
		}
	}).catch(err => {
		console.log(err);
		return Promise.reject(-1);
	}).then(d => {
		// compare metadata.wordsLastUpdated
		console.log("compare metadata.wordsLastUpdated")
		const words = JSON.parse(localStorage.getItem(localStorage_word));
		const locallyLastUpdated = localStorage.getItem(localStorage_wordLastUpdated);
		if (words == null || locallyLastUpdated == null) {
			console.log("localStorage empty")
			return Promise.reject(d.wordsLastUpdated);
		} else {
			// it exists
			if (words != null && d.wordsLastUpdated == locallyLastUpdated) {
				// up to date
				console.log("up to date", words)
				return words;
			} else {
				// fetch updated version from server
				console.log("fetch updated version from server");
				return Promise.reject(d.wordsLastUpdated);
			}
		}
	}).catch(serverLastUpdated => {
		// fetch updated data from server
		// serverLastUpdated = -1 to exit
		console.log("error caught 2, fetch updated data from server")
		return fetch("/api/words", {
			method: "GET",
			headers: {
				"Content-Type": "application/json"
			},
			credentials: "same-origin"
		}).then(r => {
			if (r.status == 200) {
				console.log("nicely returned")
				return r.json();
			} else if (r.status == 400) {
				console.log("400 received");
				throw new Error(JSON.stringify(r.json()))
			} else {
				throw new Error("server returned", r.status)
			}
		}).then(d => {
			// cache results
			if (serverLastUpdated === -1) {
				// don't got lastUpdated data from server, no point caching results
				console.log("didn't get server's lastUpdated, results not cached");
			} else {
				console.log("big success!! caching results");
				localStorage.setItem(localStorage_word, JSON.stringify(d));
				localStorage.setItem(localStorage_wordLastUpdated, serverLastUpdated);
			}
			return d;
		}).catch(err => {
			console.warn(err);
		});
	});
}

function LineFeedToBR(s) {
	// returns line feeds in s, replaces it with "<br>"
	return s.replaceAll(regex_linefeed, "<br>");
}

export {
	dispAlert, fetchTestData, fetchWordData, fetchTestDataByID, LineFeedToBR
}