import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, makeZip } from './zip';

const text = (value: string) => new TextEncoder().encode(value);

describe('zip', () => {
	it('computes the standard CRC-32', () => {
		expect(crc32(text('123456789'))).toBe(0xcbf43926);
	});

	it('writes a ZIP that unzip reads, with umlauts in the names', () => {
		const zip = makeZip([
			{ name: 'G1 – Müller–Østergaard.sgf', data: text('(;GM[1]SZ[19];B[pd])') },
			{ name: 'Liste.txt', data: text('Zwei Partien\n') }
		]);
		const dir = mkdtempSync(join(tmpdir(), 'gotv-zip-'));
		const file = join(dir, 'test.zip');
		writeFileSync(file, zip);
		// Python's zipfile checks headers and CRCs like any unzip tool.
		const out = execFileSync('python3', [
			'-c',
			'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); z.testzip(); ' +
				'[print(i.filename + "|" + z.read(i).decode()) for i in z.infolist()]',
			file
		]).toString();
		expect(out).toContain('G1 – Müller–Østergaard.sgf|(;GM[1]SZ[19];B[pd])');
		expect(out).toContain('Liste.txt|Zwei Partien');
		expect(readFileSync(file).length).toBe(zip.length);
	});
});
