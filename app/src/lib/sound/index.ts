// Notification sounds (taken over from the old app). Vite turns the imports
// into URLs. Created on first use, so nothing touches Audio during tests or
// before the page is ready.
import playfulHit from './playful_reveal_mute_hit_01.mp3';
import twoTone from './two_tone_03b.mp3';

function lazyAudio(src: string): { play: () => void } {
	let audio: HTMLAudioElement | null = null;
	return {
		play() {
			if (typeof Audio === 'undefined') {
				return;
			}
			audio = audio ?? new Audio(src);
			// Browsers refuse sound before the first user gesture; that is fine.
			audio.play().catch(() => {});
		}
	};
}

export const SOUNDS = {
	CHALLENGE_PROPOSAL_RECEIVED: lazyAudio(playfulHit),
	DIRECT_MESSAGE_RECEIVED: lazyAudio(twoTone)
};
