import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommendedTypeChecked,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: {
			parserOptions: { projectService: true },
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off',
			// "const { omitted, ...rest } = x" is how a field is left out.
			'@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }]
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		// Logic taken over from the old app (docs/umbau-svelte.md, phase 1). It
		// works on loosely typed outside data (KGS and OGS messages, JSON from
		// storage) and sends KGS messages without waiting on purpose - the
		// client handles their errors itself. Those strict rules stay off here
		// until the types are tightened; everything new (the whole UI) keeps them.
		files: ['src/lib/model/**/*.ts', 'src/lib/util/**/*.ts'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'@typescript-eslint/no-floating-promises': 'off',
			'@typescript-eslint/no-duplicate-type-constituents': 'off',
			// Destructuring where only one part is reassigned stays one statement.
			'prefer-const': ['error', { destructuring: 'all' }]
		}
	},
	{
		// Their tests were never type-checked (see tsconfig.json "exclude"):
		// lint them without type information.
		files: ['src/lib/model/**/*.test.ts', 'src/lib/util/**/*.test.ts'],
		extends: [ts.configs.disableTypeChecked]
	}
);
