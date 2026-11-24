import { effectiveNavOrder } from './navOrder.svelte.ts';

describe('effectiveNavOrder', () => {
	it('switches the KGS order to the GoTV order while a broadcast is on', () => {
		expect(effectiveNavOrder('kgs', false)).toBe('kgs');
		expect(effectiveNavOrder('kgs', true)).toBe('gotv');
		expect(effectiveNavOrder('gotv', false)).toBe('gotv');
		expect(effectiveNavOrder('gotv', true)).toBe('gotv');
	});
});
