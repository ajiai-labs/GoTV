// Order of the main menu, chosen in Einstellungen (gotv.navOrder):
// "gotv" - Live, Kalender, Kanäle, Nachspielen first, then KGS;
// "kgs"  - Beobachten, Spielen, Chat, Suche first (as KGS clients do),
//          then the GoTV parts - but while a broadcast is on, the menu
//          switches to the GoTV order with "Live" in front (user's wish).

export type NavOrder = 'gotv' | 'kgs';

const STORAGE_KEY = 'gotv.navOrder';

function load(): NavOrder {
	try {
		return localStorage.getItem(STORAGE_KEY) === 'kgs' ? 'kgs' : 'gotv';
	} catch {
		return 'gotv'; // storage disabled
	}
}

class NavOrderState {
	current: NavOrder = $state(typeof localStorage === 'undefined' ? 'gotv' : load());

	set(order: NavOrder) {
		this.current = order;
		try {
			localStorage.setItem(STORAGE_KEY, order);
		} catch {
			// not remembered without storage
		}
	}
}

export const navOrder = new NavOrderState();

// The order the menu shows: the chosen one, except that the KGS order
// switches to the GoTV order while a broadcast is on.
export function effectiveNavOrder(chosen: NavOrder, liveNow: boolean): NavOrder {
	return chosen === 'kgs' && liveNow ? 'gotv' : chosen;
}
