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

	it('drops a late answer of the old session after logging in again', async () => {
		const client = new KgsClient({ status: 'loggedIn', network: 'online', retryTimes: 0 });
		let answerOld: (msgs: Array<{ type: string }>) => void = () => {};
		vi.spyOn(client, '_receiveMessages').mockImplementationOnce(
			() => new Promise((resolve) => (answerOld = resolve))
		);
		vi.spyOn(client, 'sendMessage').mockResolvedValue(undefined);
		const onMessages = vi.fn();
		client.setOnMessages(onMessages);
		const oldPoll = client.poll(); // the old session's GET hangs
		await client.login('andy1975', 'secret'); // log out, log in again quickly
		client.setState({ status: 'loggedIn', network: 'online', retryTimes: 0 });
		answerOld([{ type: 'LOGOUT' }]); // the old GET answers late
		await oldPoll;
		expect(client.state.status).toBe('loggedIn');
		expect(onMessages).not.toHaveBeenCalledWith([{ type: 'LOGOUT' }]);
	});

	it('lets a late error of the old logout leave the new session alone', async () => {
		const client = new KgsClient({ status: 'loggedIn', network: 'online', retryTimes: 0 });
		let failLogout: (err: unknown) => void = () => {};
		const send = vi
			.spyOn(client, '_sendMessage')
			.mockImplementationOnce(() => new Promise((_, reject) => (failLogout = reject)))
			.mockResolvedValue(undefined);
		vi.spyOn(client, 'poll').mockResolvedValue(undefined);
		const logout = client.logout().catch(() => {});
		await client.login('andy1975', 'secret');
		client.setState({ status: 'loggedIn', network: 'online', retryTimes: 0 });
		failLogout({ type: 'noClient' }); // the 403 to the logout, after the new login
		await logout;
		expect(send).toHaveBeenCalledTimes(2);
		expect(client.state.status).toBe('loggedIn');
	});

	it('keeps trying while logged in, also after many failures', async () => {
		const client = new KgsClient({ status: 'loggedIn', network: 'online', retryTimes: 0 });
		const receive = vi
			.spyOn(client, '_receiveMessages')
			.mockRejectedValue({ type: 'networkError' });
		await client.poll();
		await vi.advanceTimersByTimeAsync(10 * 60_000);
		expect(receive.mock.calls.length).toBeGreaterThan(15);
		expect(client.state).toMatchObject({ status: 'loggedIn', network: 'error' });
		// A POST that gets through does not say the boards are live again.
		vi.spyOn(client, '_sendMessage').mockResolvedValue(undefined);
		await client.sendMessage({ type: 'CHAT', channelId: 1, text: 'hi' });
		expect(client.state.network).toBe('error');
		// Only an answer to the poll does.
		receive.mockResolvedValue([]);
		await vi.advanceTimersByTimeAsync(60_000);
		expect(client.state).toMatchObject({ network: 'online', retryTimes: 0 });
	});

	it('takes an answer that is not JSON as a broken connection', async () => {
		class HtmlXhr {
			status = 0;
			readyState = 0;
			responseText = '<html>Bad Gateway</html>';
			timeout = 0;
			onreadystatechange: (() => void) | null = null;
			addEventListener() {}
			open() {}
			setRequestHeader() {}
			send() {
				this.status = 200;
				this.readyState = 4;
				this.onreadystatechange?.();
			}
		}
		vi.stubGlobal('XMLHttpRequest', HtmlXhr);
		const client = new KgsClient({ status: 'loggedIn', network: 'online', retryTimes: 0 });
		await expect(client._receiveMessages()).rejects.toMatchObject({ type: 'networkError' });
		vi.unstubAllGlobals();
	});
});
