// The shape of the interface texts (de.ts, en.ts).

// "1 Partie" / "2 Partien": t(key, { count }) picks "one" for 1, else "other".
export type Plural = { one: string; other: string };

export type Message = string | Plural;

// A German section (de/*.ts) declares its texts with
// `satisfies Record<string, Message>`; its English counterpart (en/*.ts) is a
// Translation of it: exactly the same keys. A missing key is a type error
// ("Property 'x' is missing"), an extra key too (excess property check on
// the object literal), so `npm run check` fails until both match.
export type Translation<T> = { [K in keyof T]: Message };
