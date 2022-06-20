class Speaker {
	static synth = speechSynthesis
	static speakingText = "" // text currently being spoken
	static isOnRepeat = true
	static isPlaying = false

	static _newUtterance(text) {
		// references this.speakingText
		var utterance = new SpeechSynthesisUtterance(this.speakingText);
		utterance.rate = 2
		utterance.voice = this.synth.getVoices()[0];

		utterance.onend = this.utteranceEnd;

		return utterance;
	}

	static utteranceEnd() {
		// callback function
		Speaker.isPlaying = false;
		if (Speaker.isOnRepeat) {
			Speaker.synth.speak(Speaker.utterance);
		}
	}

	static speak(text) {
		this.synth.cancel(); // drop all queued utterances regardless of state

		this.speakingText = text;
		this.utterance = this._newUtterance();

		this.synth.speak(this.utterance);
		this.isPlaying = true;
	}
}

export {
	Speaker
}