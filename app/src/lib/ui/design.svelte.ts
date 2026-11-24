// The two designs of GoTV (docs/umbau-svelte.md, phase 2a): "modern" and
// "oldschool". The choice lives in this browser (localStorage) and is put on
// <html data-design>, where the CSS tokens in app.css pick it up; app.html
// applies it before the first paint.

import type { MessageKey } from '#lib/i18n/index.svelte.ts';

// 'oldschool' is shown as "Classic"; the stored value stays the same.
export type Design = 'modern' | 'modern-dark' | 'oldschool';

// Name and description are text keys (src/lib/i18n), shown with t().
export const DESIGNS: Array<{ id: Design; name: MessageKey; description: MessageKey }> = [
	{
		id: 'modern',
		name: 'settings.design.modern.name',
		description: 'settings.design.modern.description'
	},
	{
		id: 'modern-dark',
		name: 'settings.design.modernDark.name',
		description: 'settings.design.modernDark.description'
	},
	{
		id: 'oldschool',
		name: 'settings.design.oldschool.name',
		description: 'settings.design.oldschool.description'
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
