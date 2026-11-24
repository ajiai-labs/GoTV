export function isAncestor(target: HTMLElement, ancestor: HTMLElement) {
	let parent = target.parentNode;

	while (parent) {
		if (parent === ancestor) {
			return true;
		}

		parent = parent.parentNode;
	}

	return false;
}
export function isTouchDevice() {
	return (
		'ontouchstart' in window ||
		(navigator as Record<string, any>).MaxTouchPoints > 0 ||
		(navigator as Record<string, any>).msMaxTouchPoints > 0
	);
}
const MOBILE_WIDTH = 736;
export function isMobileScreen() {
	return window.innerWidth <= MOBILE_WIDTH;
}
