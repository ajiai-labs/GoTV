// The two designs of GoTV (docs/umbau-svelte.md, phase 2a): "modern" and
// "oldschool". The choice lives in this browser (localStorage) and is put on
// <html data-design>, where the CSS tokens in app.css pick it up; app.html
// applies it before the first paint.

// 'oldschool' is shown as "Classic"; the stored value stays the same.
export type Design = 'modern' | 'modern-dark' | 'oldschool';

export const DESIGNS: Array<{ id: Design; name: string; description: string }> = [
	{
		id: 'modern',
		name: 'Modern',
		description: 'Hell und ruhig, Brett und Stream stehen im Mittelpunkt.'
	},
	{
		id: 'modern-dark',
		name: 'Modern dunkel',
		description: 'Das moderne Design in dunkel – angenehm am Abend und im Kinomodus.'
	},
	{
		id: 'oldschool',
		name: 'Classic',
		description: 'Wie klassische Go-Programme: graue Fenster, Holzbrett mit plastischen Steinen.'
	}
];

const STORAGE_KEY = 'gotv.design';

function loadDesign(): Design {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		return saved === 'oldschool' || saved === 'modern-dark' ? saved : 'modern';
	} catch {
		return 'modern'; // storage disabled
	}
}

class DesignState {
	current: Design = $state(typeof localStorage === 'undefined' ? 'modern' : loadDesign());

	set(design: Design) {
		this.current = design;
		document.documentElement.dataset.design = design;
		try {
			localStorage.setItem(STORAGE_KEY, design);
		} catch {
			// not remembered without storage
		}
	}
}

export const design = new DesignState();
