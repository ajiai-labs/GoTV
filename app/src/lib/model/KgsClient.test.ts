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

	it('takes a 502 (proxy timeout) as a broken connection to retry, not a lost session', async () => {
		class FakeXhr {
			status = 0;
			readyState = 0;
			responseText = '';
			onreadystatechange: (() => void) | null = null;
			constructor(private readonly answer: number) {}
			addEventListener() {}
			open() {}
			setRequestHeader() {}
			send() {
				this.status = this.answer;
				this.readyState = 4;
				this.onreadystatechange?.();
			}
		}
		let answer = 502;
		vi.stubGlobal(
			'XMLHttpRequest',
			class extends FakeXhr {
				constructor() {
					super(answer);
				}
			}
		);
		const client = new KgsClient({ status: 'loggedIn', network: 'online', retryTimes: 0 });
		await expect(client._receiveMessages()).rejects.toMatchObject({ type: 'networkError' });
		await client.poll();
		expect(client.state).toMatchObject({ status: 'loggedIn', network: 'error', retryTimes: 1 });
		// A 4xx still means KGS no longer knows this client.
		answer = 403;
		await expect(client._receiveMessages()).rejects.toMatchObject({ type: 'noClient' });
		vi.unstubAllGlobals();
	});
});
