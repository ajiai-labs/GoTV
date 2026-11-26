// The look of the stones (wish of the user, 26.11.2026): white like clam
// shell stones - muted ivory with fine, gently curved growth lines, every
// stone turned differently - and black like matte slate. White is drawn 2 %
// smaller, as in real Go sets: light stones look bigger than dark ones.

export const STONE_RADIUS = 0.475;
export const WHITE_RADIUS = STONE_RADIUS * 0.98;

// A few prepared line patterns are enough: neighbouring stones get
// different ones, and each is drawn at its own angle.
export const SHELL_VARIANTS = 8;

export type ShellLine = { d: string; width: number; opacity: number };

function random(seed: number): () => number {
	// mulberry32: the same lines on every render and every device.
	let state = seed;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// The growth lines of one variant around (0, 0), already rotated; the
// board clips them to the stone.
export function shellLines(variant: number): Array<ShellLine> {
	const rnd = random(variant * 7919 + 17);
	const angle = (variant / SHELL_VARIANTS) * Math.PI + rnd() * 0.3;
	const bend = 1.6 + rnd() * 1.2; // radius of the arcs: larger = straighter
	const r = WHITE_RADIUS + 0.1;
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	const turn = (x: number, y: number) =>
		`${(x * cos - y * sin).toFixed(3)} ${(x * sin + y * cos).toFixed(3)}`;
	const lines: Array<ShellLine> = [];
	let offset = -WHITE_RADIUS;
	for (;;) {
		offset += 0.035 + rnd() * 0.05;
		if (offset >= WHITE_RADIUS) break;
		const width = 0.006 + rnd() * 0.014;
		const opacity = 0.1 + rnd() * 0.16;
		lines.push({
			d: `M ${turn(-r, offset)} A ${bend.toFixed(2)} ${bend.toFixed(2)} 0 0 1 ${turn(r, offset)}`,
			width: Number(width.toFixed(3)),
			opacity: Number(opacity.toFixed(2))
		});
	}
	return lines;
}

// Which variant a point gets: fixed per point, so a stone never changes its
// look while the game goes on; neighbours (also diagonal) always differ.
export function shellVariant(x: number, y: number): number {
	return (x * 3 + y * 7) % SHELL_VARIANTS;
}
