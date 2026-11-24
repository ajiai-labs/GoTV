// The followed KGS players as reactive state: a star in a profile updates
// the lists on Live and Beobachten at once.
import {
	isFollowed,
	loadFollowedPlayers,
	saveFollowedPlayers,
	toggleFollowed
} from '#lib/model/FollowedPlayers.ts';

class FollowedState {
	names: Array<string> = $state(typeof localStorage === 'undefined' ? [] : loadFollowedPlayers());

	has(name: string): boolean {
		return isFollowed(this.names, name);
	}

	toggle(name: string) {
		this.names = toggleFollowed(this.names, name);
		saveFollowedPlayers(this.names);
	}
}

export const followed = new FollowedState();
