// Which of a language's sixteen note files a place is in (data/notes/):
// one definition, for the page that fetches the file and the test that
// checks each entry sits in the right one.
export const NOTE_SHARDS = 16;
export const noteShard = (id) => [...String(id)].reduce((n, ch) => (n + ch.charCodeAt(0)) % NOTE_SHARDS, 0);
