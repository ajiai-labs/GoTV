// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	// Timer handles, as Flow named them in the logic taken over from the old app.
	type IntervalID = ReturnType<typeof setInterval>;
	type TimeoutID = ReturnType<typeof setTimeout>;

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
