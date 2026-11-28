import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { getRecentVideos, validateTvVideo } from '#lib/model/tv.ts';
import type { TvChannel, TvVideo } from '#lib/model/tv.ts';
import ChannelVideos from './ChannelVideos.svelte';

const NOW = Date.parse('2026-11-28T12:00:00Z');
const channels = [
	{
		id: 'egf-youtube',
		name: 'European Go Federation',
		platform: 'youtube',
		url: 'x',
		channel_id: 'UC1'
	},
	{
		id: 'aga-youtube',
		name: 'American Go Association',
		platform: 'youtube',
		url: 'x',
		channel_id: 'UC2'
	}
] as Array<TvChannel>;

function video(id: string, channel: string, published: string, title = 'Round ' + id): TvVideo {
	return { channel, videoId: id, title, published };
}

describe('channel videos', () => {
	it('reads only complete entries from events.json', () => {
		expect(
			validateTvVideo({
				channel: 'egf-youtube',
				video_id: 'AbCdEfGhIjK',
				title: ' German Championship Round 4 ',
				published: '2026-10-31T00:50:00Z'
			})
		).toEqual({
			channel: 'egf-youtube',
			videoId: 'AbCdEfGhIjK',
			title: 'German Championship Round 4',
			published: '2026-10-31T00:50:00Z'
		});
		expect(
			validateTvVideo({ channel: 'x', video_id: 'bad id!', title: 't', published: '2026-01-01' })
		).toBeNull();
		expect(
			validateTvVideo({ channel: 'x', video_id: 'AbCdEfGhIjK', title: '', published: 'x' })
		).toBeNull();
	});

	it('lists the newest of known channels, three per channel at most', () => {
		const many = ['1', '2', '3', '4', '5'].map((n) =>
			video('BBBBBBBBBB' + n, 'aga-youtube', `2026-11-2${n}T10:00:00Z`)
		);
		const recent = getRecentVideos(
			[...many, video('AAAAAAAAAA1', 'egf-youtube', '2026-11-01T10:00:00Z')],
			channels,
			new Date(NOW)
		);
		expect(recent.map((v) => v.videoId)).toEqual([
			'BBBBBBBBBB5',
			'BBBBBBBBBB4',
			'BBBBBBBBBB3',
			'AAAAAAAAAA1'
		]);
	});

	it('leaves out old videos and unknown channels', () => {
		const recent = getRecentVideos(
			[
				video('AAAAAAAAAA1', 'egf-youtube', '2026-11-20T10:00:00Z'),
				video('AAAAAAAAAA2', 'aga-youtube', '2026-11-25T10:00:00Z'),
				video('AAAAAAAAAA3', 'egf-youtube', '2026-08-01T10:00:00Z'), // too old
				video('AAAAAAAAAA4', 'unknown', '2026-11-27T10:00:00Z') // channel gone
			],
			channels,
			new Date(NOW)
		);
		expect(recent.map((v) => [v.videoId, v.channelName])).toEqual([
			['AAAAAAAAAA2', 'American Go Association'],
			['AAAAAAAAAA1', 'European Go Federation']
		]);
	});

	it('opens a video behind the two-click placeholder', async () => {
		const view = await render(ChannelVideos, {
			videos: [
				video('AAAAAAAAAA1', 'egf-youtube', '2026-10-31T00:50:00Z', 'German Championship Round 4')
			],
			channels,
			now: NOW
		});
		await expect
			.element(page.getByRole('heading', { name: 'Neue Videos der Kanäle' }))
			.toBeVisible();
		await expect.element(page.getByText(/European Go Federation · /)).toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Auf YouTube' }))
			.toHaveAttribute('href', 'https://www.youtube.com/watch?v=AAAAAAAAAA1');
		await page.getByRole('button', { name: /German Championship Round 4/ }).click();
		// Nothing from YouTube before the second click.
		expect(view.container.querySelector('iframe')).toBeNull();
		await page.getByRole('button', { name: 'Stream laden' }).click();
		expect(view.container.querySelector('iframe')?.getAttribute('src')).toContain(
			'youtube-nocookie.com/embed/AAAAAAAAAA1'
		);
	});

	it('shows nothing without videos', async () => {
		await render(ChannelVideos, { videos: [], channels, now: NOW });
		await expect.element(page.getByText('Neue Videos der Kanäle')).not.toBeInTheDocument();
	});
});
