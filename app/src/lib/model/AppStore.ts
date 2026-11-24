import { get, set } from 'idb-keyval';
import type { AppState, KgsMessage } from './types';
export class AppStore {
	_state: {
		appState: AppState;
	};
	_handler: (state: AppState, msg: KgsMessage) => any;
	_subscriber: ((...args: Array<any>) => any) | null | undefined;
	_debug: boolean;
	_recording: boolean;
	_recordedMessages: Array<KgsMessage>;

	constructor(handler: (appState: AppState, msg: KgsMessage) => any, initialState: AppState) {
		this._handler = handler;
		this._state = {
			appState: initialState
		};
		this._debug = process.env.NODE_ENV === 'development';
		this._recording = false;
		this._recordedMessages = [];
	}

	dispatch = (msgs: KgsMessage | Array<KgsMessage>) => {
		const prevState = this.getState();
		msgs = Array.isArray(msgs) ? msgs : [msgs];
		const nextState: AppState = msgs.reduce(
			(accState, msg) => this._handler(accState, msg),
			prevState
		);
		this.setState(nextState);

		if (this._subscriber) {
			this._subscriber();
		}

		if (this._recording) {
			const clonedMsgs: Array<KgsMessage> = JSON.parse(JSON.stringify(msgs));

			this._recordedMessages.push(...clonedMsgs);
		}
	};
	subscribe = (f: (...args: Array<any>) => any) => {
		if (this._subscriber) {
			throw new Error('Only one subscriber allowed');
		}

		this._subscriber = f;
	};
	unsubscribe = () => {
		this._subscriber = null;
	};
	setState = (nextState: AppState) => {
		this._state.appState = nextState;
	};
	getState = () => {
		return this._state.appState;
	};
	saveState = (saveKey: string, prepareSavedState?: (arg0: AppState) => AppState) => {
		let saveState: AppState = { ...this.getState(), savedAt: new Date() };

		if (prepareSavedState) {
			saveState = prepareSavedState(saveState);
		}

		if (this._debug) {
			console.log('Saving app state...', {
				state: saveState
			});
		}

		set(saveKey, saveState);
	};
	restoreSavedState = (saveKey: string, done: (arg0: AppState) => any) => {
		const prevState = this.getState();
		get(saveKey)
			.then((savedAppState) => {
				if (this._debug) {
					console.log('Restoring saved app state...', savedAppState);
				}

				if (savedAppState) {
					this.setState(savedAppState);
				}

				done(this.getState());
			})
			.catch((err) => {
				if (!navigator.userAgent.includes('jsdom')) {
					console.warn('Unable to restore saved app state: ', err); // Revert everything, just in case we errored out in a sync render due
					// to bad app state data
				}

				if (prevState) {
					this.setState(prevState);
				}

				done(this.getState());
			});
	};
	startRecording = () => {
		this._recordedMessages = [];
		this._recording = true;
	};
	stopRecording = () => {
		this._recording = false;
		return this._recordedMessages;
	};
}
