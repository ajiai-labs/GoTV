export function isJsError(err: unknown) {
	return (
		err instanceof TypeError ||
		err instanceof SyntaxError ||
		err instanceof ReferenceError ||
		err instanceof RangeError
	);
}
export class InvariantError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'InvariantError';
	}
}
// A plain object from outside (JSON, OGS, storage) whose fields can be
// read and checked one by one - what Flow allowed after typeof "object".
export function isRecord(value: unknown): value is Record<string, any> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

// The message of anything thrown (an Error or something else).
export function errorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}
