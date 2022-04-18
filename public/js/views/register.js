import { dispAlert } from "./../includes/default.js";
const usernamefriendly = /^[a-zA-Z\d]*$/;

$.fn.isValid = function() {
	return this[0].checkValidity();
}

$(document).ready(function(e) {
	// clear sessionStorage; possibly redirected from /logout
	localStorage.clear();
	sessionStorage.clear();

	const $form = $("#interface-card")
	const $usernameInput = $("#usernameInput");
	const $passwordInput = $("#passwordInput");
	const $licenseInput = $("#licenseInput");
	const $submit = $("#proceed");

	const $submitText = $("#submitButtonText");
	const $submitLoader = $("#submitLoader")

	const showMap = ["none", "block"]; // maps boolean value to corresponding style values
	function showSubmitSpinner(toShow) {
		// toShow: boolean; whether to show spinner or not
		$submitText.css("style", showMap[!toShow]);
		$submitLoader.css("style", showMap[toShow]);
	}

	$usernameInput.on("input", (e) => {
		$usernameInput[0].setCustomValidity('');
	})

	$usernameInput.on("change", (e) => {
		console.log("YESS")
		e.preventDefault();
		e.stopPropagation();

		// verify username key
		fetch("/api/vu", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				username: $usernameInput.val()
			})
		}).then(r => {
			console.log(r.status)
			if (r.status != 200) {
				$usernameInput[0].setCustomValidity("username taken");
				$usernameInput[0].reportValidity();
			}
		})
	})

	$licenseInput.on("input", (e) => {
		$licenseInput[0].setCustomValidity('');
	})

	$licenseInput.on("change", (e) => {
		e.stopPropagation();

		// verify license key
		fetch("/api/vlk", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				licenseKey: $licenseInput.val()
			})
		}).then(r => {
			if (r.status != 200) {
				$licenseInput[0].setCustomValidity("license key invalid");
				$licenseInput[0].reportValidity();
			}
		})
	})

	var processing = false; // debounce value; sort-of
	$form.on("submit", (e) => {
		// submit event
		if (processing) return; // debounce; don't allow double clicks

		processing = true;
		e.preventDefault();
		e.stopPropagation();
		// var isUserValid = $usernameInput.isValid();
		// var isPassValid = $passwordInput.isValid();

		// effects
		showSubmitSpinner(true);

		var isFormValid = $form.isValid();
		if (isFormValid) {
			// valid forms
			// send fetch signal
			fetch("/api/register", {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					username: $usernameInput.val(),
					password: $passwordInput.val(),
					licenseKey: $licenseInput.val()
				})
			}).then(res => {
				if (res.status == 200) {
					// valid
					return res.json();
				} else if (res.status == 401) {
					throw new Error("license key invalid");
				} else {
					// server invalidated request
					console.log("bad bad", processing);
					return new Promise((resolve, rej) => {
						resolve(res.json());
					}).then(d => {
						throw new Error(d.error);
					})
				}
			}).then(res => {
				// empty json object
				showSubmitSpinner(false);
				processing = false; // reset debounce state

				// success, redirect login page
				window.location.replace("/"); // redirect to login page
			}).catch(errMsg => {

				dispAlert(errMsg.toString());
				showSubmitSpinner(false);
				processing = false; // reset debounce state
			})
		} else {
			processing = false;
			showSubmitSpinner(false);
		}
	})
})