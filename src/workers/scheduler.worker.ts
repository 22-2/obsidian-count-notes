// Scheduler worker: runs timers inside worker and posts messages to main thread
// Messages accepted:
// { cmd: 'start', collectInterval: number, statusInterval: number }
// { cmd: 'stop' }
// { cmd: 'update', collectInterval?: number, statusInterval?: number }

self.onmessage = function (e) {
    const data = e.data;
    if (!data || !data.cmd) return;

    if (data.cmd === 'start') {
        // clear existing
        // @ts-expect-error
        if (self._collectTimer) { clearInterval(self._collectTimer); self._collectTimer = undefined; }
        // @ts-expect-error
        if (self._statusTimer) { clearInterval(self._statusTimer); self._statusTimer = undefined; }
        // @ts-expect-error
        if (self._tickTimer) { clearInterval(self._tickTimer); self._tickTimer = undefined; }

        if (typeof data.collectInterval === 'number') {
            // @ts-expect-error
            self._collectTimer = setInterval(function () { self.postMessage({ type: 'collect' }); }, data.collectInterval);
        }
        if (typeof data.statusInterval === 'number') {
            // @ts-expect-error
            self._statusTimer = setInterval(function () { self.postMessage({ type: 'status' }); }, data.statusInterval);
        }
        if (typeof data.tickInterval === 'number') {
            // @ts-expect-error
            self._tickTimer = setInterval(function () { self.postMessage({ type: 'tick', now: Date.now() }); }, data.tickInterval);
        }
        return;
    }

    if (data.cmd === 'stop') {
        // @ts-expect-error
        if (self._collectTimer) { clearInterval(self._collectTimer); self._collectTimer = undefined; }
        // @ts-expect-error
        if (self._statusTimer) { clearInterval(self._statusTimer); self._statusTimer = undefined; }
        // @ts-expect-error
        if (self._tickTimer) { clearInterval(self._tickTimer); self._tickTimer = undefined; }
        return;
    }

    if (data.cmd === 'update') {
        // update timers
        // just restart with new values if provided
        // @ts-expect-error
        if (self._collectTimer) { clearInterval(self._collectTimer); self._collectTimer = undefined; }
        // @ts-expect-error
        if (self._statusTimer) { clearInterval(self._statusTimer); self._statusTimer = undefined; }
        // @ts-expect-error
        if (self._tickTimer) { clearInterval(self._tickTimer); self._tickTimer = undefined; }
        if (typeof data.collectInterval === 'number') {
            // @ts-expect-error
            self._collectTimer = setInterval(function () { self.postMessage({ type: 'collect' }); }, data.collectInterval);
        }
        if (typeof data.statusInterval === 'number') {
            // @ts-expect-error
            self._statusTimer = setInterval(function () { self.postMessage({ type: 'status' }); }, data.statusInterval);
        }
        if (typeof data.tickInterval === 'number') {
            // @ts-expect-error
            self._tickTimer = setInterval(function () { self.postMessage({ type: 'tick', now: Date.now() }); }, data.tickInterval);
        }
        return;
    }
};

export {};
