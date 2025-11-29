// Worker: sends current timestamp every second when it receives 'start', stops on 'stop'
self.onmessage = function (e) {
	if (e && e.data === "start") {
		// @ts-ignore - attach to self
		self._timer = setInterval(function () {
			self.postMessage({ now: Date.now() });
		}, 1000);
	} else if (e && e.data === "stop") {
		// @ts-ignore
		if (self._timer) {
			// @ts-expect-error
			clearInterval(self._timer);
			// @ts-expect-error
			self._timer = undefined;
		}
	}
};

export {};
