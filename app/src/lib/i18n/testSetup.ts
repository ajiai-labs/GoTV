// Tests run in German, the approved wording they look for: every test starts
// with German, whatever the browser's language is. A test that switches to
// English does not leak into the next one.
import { beforeEach } from 'vitest';
import { language } from './index.svelte.ts';

language.current = 'de';

beforeEach(() => {
	language.current = 'de';
});
