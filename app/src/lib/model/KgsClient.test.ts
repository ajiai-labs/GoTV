// The receive loop must survive an empty KGS answer after a reconnect
// (network switch, standby) - it used to read the last message of an empty
// list, throw, and never poll again.
import { KgsClient } from './KgsClient';

describe('KgsClient.poll', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('keeps polling after an empty answer while reconnecting', async () => {
		const client = new KgsClient({ status: 'loggedIn', network: 'error', retryTimes: 2 });
		const receive = vi
			.spyOn(client, '_receiveMessages')
			.mockResolvedValueOnce([])
			.mockResolvedValue([{ type: 'HELLO' }]);
		const onMessages = vi.fn();
		client.setOnMessages(onMessages);

		await client.poll();
		expect(client.state).toMatchObject({ status: 'loggedIn', network: 'online', retryTimes: 0 });

		await vi.advanceTimersByTimeAsync(10);
		expect(receive.mock.calls.length).toBeGreaterThanOrEqual(2);
		expect(onMessages).toHaveBeenLastCalledWith([{ type: 'HELLO' }]);
	});

	it('still marks a reconnect that ends in a logout as an expired session', async () => {
		const client = new KgsClient({ status: 'loggedIn', network: 'error', retryTimes: 1 });
		vi.spyOn(client, '_receiveMessages').mockResolvedValue([{ type: 'LOGOUT' }]);
		const onMessages = vi.fn();
		client.setOnMessages(onMessages);

		await client.poll();
		expect(onMessages).toHaveBeenCalledWith([{ type: 'LOGOUT' }, { type: 'SESSION_EXPIRED' }]);
		expect(client.state.status).toBe('loggedOut');
	});
});
