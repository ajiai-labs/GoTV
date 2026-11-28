import type { KgsClientState, KgsMessage } from './types';
import { isJsError, isRecord } from '../util/error';
import { escapeUnicode } from '../util/string';
import { config } from '../config';
export class ApiError extends Error {
	type: string;
	xhr: XMLHttpRequest;

	constructor(message: string, type: string, xhr: XMLHttpRequest) {
		super(message);
		this.type = type;
		this.xhr = xhr;
	}
}
const initialClientState: KgsClientState = {
	status: 'loggedOut',
	network: 'online',
	retryTimes: 0
};
// Retries of a failed poll: 3 s, doubling up to 30 s.
const RETRY_MS = 3000;
const RETRY_MAX_MS = 30_000;
// KGS answers a long poll well within this; longer means the line is dead.
const POLL_TIMEOUT_MS = 120_000;

// A POST to KGS that has no answer after this long counts as a broken
// connection (the queue of requests goes on).
const SEND_TIMEOUT_MS = 30_000;

type SendMessageOptions = {
	sync?: boolean;
};
type StateChangeListener = (nextState: KgsClientState, prevState: KgsClientState) => any;
export class KgsClient {
	state: KgsClientState;
	_onChange: StateChangeListener | null | undefined = null;
	_onMessages: ((messages: Array<KgsMessage>) => any) | null | undefined;
	_debug: boolean = config.dev;
	_apiUrl: string;
	// One receive loop per KGS session (review 26.11.2026): a login starts a
	// new session; answers and retries of the old one are dropped, so a late
	// LOGOUT of the old poll cannot log the new session out.
	_session = 0;
	_pollActive = false;
	_pollXhr: XMLHttpRequest | null = null;

	constructor(state: KgsClientState = initialClientState) {
		this.state = state;

		if (config.apiUrl) {
			this._apiUrl = config.apiUrl;
		} else {
			const isProd = window.location.host.indexOf('gokgs.com') !== -1;
			const isSafari = window.navigator.vendor && window.navigator.vendor.indexOf('Apple') > -1;

			if (isProd) {
				this._apiUrl = 'https://www.gokgs.com/json-cors/access';
			} else if (!isSafari) {
				this._apiUrl = '/api/json-cors/access';
			} else {
				// Dev proxy for Safari
				this._apiUrl = '/json/access';
			}
		}

		console.log('[KGS Client] Using endpoint ' + this._apiUrl);
	}

	setState = (nextState: KgsClientState) => {
		const isSameState =
			nextState.status === this.state.status &&
			nextState.network === this.state.network &&
			nextState.retryTimes === this.state.retryTimes;

		if (isSameState) {
			return;
		}

		const prevState = this.state;
		this.state = nextState;

		if (this._debug) {
			console.log('[KGS Client] State changed', {
				state: this.state,
				prevState
			});
		}

		if (this._onChange) {
			this._onChange(nextState, prevState);
		}
	};
	setOnChange = (listener: StateChangeListener | null | undefined) => {
		this._onChange = listener;
	};
	setOnMessages = (listener: ((messages: Array<KgsMessage>) => any) | null | undefined) => {
		this._onMessages = listener;
	};
	login = async (username: string, password: string, locale: string = 'en_US') => {
		this._session++;
		this._pollActive = false;
		this._pollXhr?.abort();
		this._pollXhr = null;
		this.setState({ ...this.state, status: 'loggingIn' });

		try {
			await this.sendMessage({
				type: 'LOGIN',
				name: username,
				password,
				locale
			});
			setTimeout(() => {
				if (this._debug) {
					console.log('[KGS Client] Starting polling');
				}

				this.poll();
			}, 0);
		} catch (err) {
			// Any login errors are available to callers via client state
			console.warn(err);
		}
	};
	logout = (opts: SendMessageOptions = {}) => {
		// Sometimes network failure happens due to device sleeping or swiching
		// tasks. Attempt to go back online to avoid showing show the user a
		// network error on login screen. If we're truly offline, sendMessage
		// will put us back into that state.
		this.setState({ ...this.state, network: 'online', status: 'loggingOut' });
		return this.sendMessage(
			{
				type: 'LOGOUT'
			},
			opts
		);
	};
	// Requests go to KGS one after the other, each when KGS answered the one
	// before (28.11.2026). Sent at once, a later request could reach KGS first
	// - an UNJOIN_REQUEST overtook the profile change for that channel, and
	// KGS ended the whole session ("Unknown channel"). A new login starts a
	// new queue; what an old session still had queued is dropped, never sent
	// into the new one (its channels are not the new session's).
	_sendTail: Promise<unknown> | null = null;

	sendMessage = (msg: KgsMessage, opts: SendMessageOptions = {}): Promise<void> => {
		if (msg.type === 'LOGIN') this._sendTail = null;
		const session = this._session;
		const start = () =>
			session === this._session ? this._sendNow(msg, opts, session) : Promise.resolve();
		// Nothing on its way: the request goes at once (not a moment later).
		const run = this._sendTail ? this._sendTail.then(start, start) : start();
		const tail = run.catch(() => {});
		this._sendTail = tail;
		void tail.then(() => {
			if (this._sendTail === tail) this._sendTail = null;
		});
		return run;
	};

	_sendNow = async (msg: KgsMessage, opts: SendMessageOptions, session: number) => {
		if (this._debug) {
			console.log(
				'[KGS Client] >> ' + msg.type,
				msg.type === 'LOGIN' ? { ...msg, password: '...' } : msg
			);
		}

		try {
			await this._sendMessage(msg, opts);
			// Logged in, only a successful poll says the connection is live
			// again - a POST that gets through does not bring moves.
			if (this.state.status !== 'loggedIn') {
				this.setState({ ...this.state, network: 'online', retryTimes: 0 });
			}
		} catch (err) {
			if (isJsError(err) || (err instanceof Error && err.name === 'InvariantError')) {
				// Likely an error in the app, not with network or client
				throw err;
			}
			// An answer to a request of the old session (e.g. a 403 to the
			// logout, arriving after logging in again) says nothing about this one.
			if (session !== this._session) throw err;

			const nextState: KgsClientState = { ...this.state };

			if (isRecord(err) && err.type === 'noClient') {
				nextState.status = 'loggedOut';
				nextState.network = 'online';
				nextState.retryTimes = 0;
			} else {
				// TODO - detect bad request, don't change state
				nextState.network = 'error';

				if (this.state.status === 'loggingIn') {
					nextState.status = 'loggedOut';
				} else if (this.state.status === 'loggingOut') {
					// Log out failed - just pretend it worked
					nextState.status = 'loggedOut';
				}
			}

			this.setState(nextState);
			// Propogate anyway, so errors can be handled by appropriate UI
			throw err;
		}
	};
	poll = async () => {
		const session = this._session;
		if (this._pollActive) return; // this session's loop runs already
		this._pollActive = true;
		let messages;

		try {
			messages = await this._receiveMessages();
			this._pollActive = false;
			if (session !== this._session) return; // an answer of the old session

			if (this.state.retryTimes) {
				// Reconnected. KGS may answer with no messages at all (e.g. after a
				// network switch or standby) - that must not stop the loop.
				const last = messages.length ? messages[messages.length - 1] : null;
				if (last && last.type === 'LOGOUT') {
					// We reconnected only to be immediately logged out. Ensure an
					// appropriate error is shown to the user
					messages.push({
						type: 'SESSION_EXPIRED'
					});
				}
			}

			const nextState: KgsClientState = { ...this.state, network: 'online', retryTimes: 0 };

			if (messages.find((msg) => msg.type === 'LOGOUT')) {
				nextState.status = 'loggedOut';
			} else if (messages.find((msg) => msg.type === 'LOGIN_SUCCESS')) {
				nextState.status = 'loggedIn';
			}

			this.setState(nextState);

			if (this._debug) {
				console.log('[KGS Client] << ', messages);
			}

			if (this._onMessages) {
				try {
					this._onMessages(messages);
				} catch (handlerError) {
					// A bug while handling one answer must not end the connection.
					console.error('[KGS Client] Handling messages failed', handlerError);
				}
			}

			if (nextState.status !== 'loggedOut') {
				setTimeout(() => {
					this.poll();
				}, 0);
			} else if (this._debug) {
				console.log('[KGS Client] Stopped polling');
			}
		} catch (err) {
			this._pollActive = false;
			if (session !== this._session) return; // the old session's poll (aborted)
			if (isJsError(err) || (err instanceof Error && err.name === 'InvariantError')) {
				// Likely an error in the app, not with network or client
				throw err;
			}

			const nextState: KgsClientState = { ...this.state };

			if (isRecord(err) && err.type === 'noClient') {
				nextState.status = 'loggedOut';
				nextState.network = 'online';
				nextState.retryTimes = 0;
			} else {
				const { retryTimes } = this.state;
				// Logged in: keep trying, ever more slowly (3 s up to 30 s), so the
				// boards come back after a long outage; a login attempt gives up.
				const keepTrying =
					this.state.status === 'loggedIn' ||
					(retryTimes < 10 && this.state.status !== 'loggedOut');

				if (keepTrying) {
					nextState.retryTimes = retryTimes + 1;
					nextState.network = 'error';

					if (this._debug) {
						console.log('[KGS Client] Poll failed - retry', nextState.retryTimes);
					}

					const delay = Math.min(RETRY_MAX_MS, RETRY_MS * 2 ** Math.min(retryTimes, 4));
					setTimeout(() => {
						if (session === this._session) this.poll();
					}, delay);
				} else {
					nextState.network = 'error';
					nextState.retryTimes = 0;

					if (this.state.status === 'loggingIn') {
						nextState.status = 'loggedOut';
					} else if (this.state.status === 'loggingOut') {
						// Log out failed - just pretend it worked
						nextState.status = 'loggedOut';
					}
				}
			}

			this.setState(nextState);
			console.warn(err);
		}
	};
	_receiveMessages = (): Promise<Array<KgsMessage>> => {
		return new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			this._pollXhr = xhr;

			const onError = () => {
				// A 5xx (e.g. 502 from the local proxy after a timeout) is a broken
				// connection to retry, not a lost session.
				const errorType = xhr.status && xhr.status < 500 ? 'noClient' : 'networkError';
				const err = new ApiError('Receive failed', errorType, xhr);
				reject(err);
			};

			xhr.onreadystatechange = function () {
				if (xhr.readyState === 4) {
					if (xhr.status === 200) {
						// Not JSON (e.g. an HTML page from a proxy): a broken connection.
						try {
							const resp = JSON.parse(xhr.responseText) as { messages?: Array<KgsMessage> };
							resolve(Array.isArray(resp?.messages) ? resp.messages : []);
						} catch {
							reject(new ApiError('Receive failed: no JSON', 'networkError', xhr));
						}
					} else {
						onError();
					}
				}
			};

			xhr.addEventListener('error', onError);
			xhr.addEventListener('abort', onError);
			xhr.addEventListener('timeout', onError);
			xhr.open('GET', this._apiUrl, true);
			// A long poll that never answers counts as broken and is retried.
			xhr.timeout = POLL_TIMEOUT_MS;
			xhr.setRequestHeader('Accept', 'application/json;charset=UTF-8');
			xhr.withCredentials = true;
			xhr.send();
		});
	};
	_sendMessage = (msg: KgsMessage, opts: SendMessageOptions = {}): Promise<any> => {
		return new Promise<void>((resolve, reject) => {
			const xhr = new XMLHttpRequest();

			const onError = () => {
				// A 5xx (e.g. 502 from the local proxy after a timeout) is a broken
				// connection to retry, not a lost session.
				const errorType = xhr.status && xhr.status < 500 ? 'noClient' : 'networkError';
				const err = new ApiError('Send failed', errorType, xhr);
				reject(err);
			};

			xhr.onreadystatechange = function () {
				if (xhr.readyState === 4) {
					if (xhr.status === 200) {
						resolve();
					} else {
						onError();
					}
				}
			};

			xhr.addEventListener('error', onError);
			xhr.addEventListener('abort', onError);
			xhr.addEventListener('timeout', onError);
			const async = opts.sync === undefined ? true : opts.sync;
			xhr.open('POST', this._apiUrl, async);
			// A request that hangs must not hold up the ones behind it.
			if (async) xhr.timeout = SEND_TIMEOUT_MS;
			xhr.withCredentials = true;
			xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
			xhr.send(escapeUnicode(JSON.stringify(msg)));
		});
	};
}
