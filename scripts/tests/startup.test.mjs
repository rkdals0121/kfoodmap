// The script at the top of index.html decides, before any of the app has
// arrived, which language file and which of the map's files to ask for.
// It has to agree with the app's own rules (src/i18n/index.js
// detectLanguage, src/startup.js firstVisit): a difference shows the
// welcome screen while the map's files are fetched in front of it, or
// fetches a language the app then does not use.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { detectLanguage, LANGUAGES } from '../../src/i18n/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const head = scripts.find(s => s.includes('__kfmWelcome'));

// Runs the head script as a browser would, with the given visit.
function visit({ languages = ['en-US'], stored = {}, pathname = '/', search = '', blocked = false, locale = { ko: '/assets/ko-x.js', ja: '/assets/ja-x.js' }, map = ['/assets/App-x.js', '/assets/places-x.js'] } = {}) {
  const links = [];
  const page = { lang: 'en' };
  const window = {};
  const context = {
    window,
    navigator: { languages, language: languages[0] },
    location: { pathname, search },
    localStorage: { getItem: (key) => { if (blocked) throw new Error('blocked'); return stored[key] ?? null; } },
    document: { createElement: () => ({}), head: { appendChild: (el) => links.push(el) }, documentElement: page },
  };
  const code = head.replace('/*KFM_LOCALE_CHUNKS*/{}', JSON.stringify(locale)).replace('/*KFM_MAP_CHUNKS*/[]', JSON.stringify(map));
  vm.runInNewContext(code, context);
  return { pageLang: page.lang, language: window.__kfmL, welcome: window.__kfmWelcome, asked: links.filter(l => l.rel === 'modulepreload').map(l => l.href), preconnect: links.filter(l => l.rel === 'preconnect').map(l => l.href) };
}

test('index.html has the head script, above the stylesheets, with both slots', () => {
  assert.ok(head, 'no script sets __kfmWelcome');
  assert.ok(head.includes('/*KFM_LOCALE_CHUNKS*/{}') && head.includes('/*KFM_MAP_CHUNKS*/[]'));
  assert.ok(html.indexOf('__kfmWelcome') < html.indexOf('</head>'));
});

test('the head script reads the browser language as the app does', () => {
  const tags = ['ja', 'ja-JP', 'zh', 'zh-CN', 'zh-TW', 'zh-HK', 'zh-MO', 'zh-Hant', 'zh-Hant-TW', 'zh-Hans-CN', 'zh-SG', 'ko', 'ko-KR', 'id', 'id-ID', 'in', 'en', 'en-GB', 'ms', 'ms-MY', 'fr-FR', 'th', 'de', 'jam', 'kok', 'idx', 'eng'];
  for (const tag of tags) {
    assert.equal(visit({ languages: [tag] }).language, detectLanguage([tag]), tag);
    // …and with a second choice behind an unknown first one.
    assert.equal(visit({ languages: ['xx', tag] }).language, detectLanguage(['xx', tag]), `xx, ${tag}`);
  }
  assert.equal(visit({ languages: [] }).language, 'en');
});

test('a stored language wins, if it is one of ours', () => {
  for (const { code } of LANGUAGES) assert.equal(visit({ languages: ['fr'], stored: { 'kfm-language': code } }).language, code);
  assert.equal(visit({ languages: ['ja'], stored: { 'kfm-language': 'xx' } }).language, 'ja');
  assert.equal(visit({ languages: ['ko'], blocked: true }).language, 'ko');
});

test('a first visit to the map is greeted, and does not fetch the map in front of the welcome screen', () => {
  const first = visit({ languages: ['ko'] });
  assert.equal(first.welcome, true);
  assert.deepEqual(first.asked, ['/assets/ko-x.js']);
  assert.deepEqual(first.preconnect, []);
  // Storage blocked: not seen, so greeted.
  assert.equal(visit({ blocked: true }).welcome, true);
  // Other pages of the app greet too (the welcome screen stands over them).
  for (const pathname of ['/cards', '/discover', '/journal', '/profile', '/privacy', '/submit', '/placeholder', '/finder']) {
    assert.equal(visit({ pathname }).welcome, true, pathname);
  }
});

test('every other visit asks for the map at once', () => {
  const seen = { 'kfm-prologue': 'true' };
  const cases = [
    { stored: seen },
    { pathname: '/place/balwoo' },
    { pathname: '/place/balwoo/' },
    { pathname: '/find/vegan/' },
    { pathname: '/find/halal/seoul' },
    { search: '?list=balwoo,eid' },
    { search: '?utm=x&list=balwoo' },
  ];
  for (const c of cases) {
    const v = visit({ languages: ['en'], ...c });
    assert.equal(v.welcome, false, JSON.stringify(c));
    assert.deepEqual(v.asked, ['/assets/App-x.js', '/assets/places-x.js'], JSON.stringify(c));
    assert.equal(v.preconnect.length, 1);
  }
  // A stored value other than 'true' is not "seen".
  assert.equal(visit({ stored: { 'kfm-prologue': '1' } }).welcome, true);
});

test('src/startup.js follows the same rule when the head script has not run', async () => {
  const source = readFileSync(join(root, 'src', 'startup.js'), 'utf8');
  for (const piece of ["localStorage.getItem('kfm-prologue') === 'true'", '/^\\/(place|find)\\//', '/[?&]list=/']) {
    assert.ok(source.includes(piece), `startup.js: ${piece}`);
  }
  for (const piece of ["localStorage.getItem('kfm-prologue')==='true'", '/^\\/(place|find)\\//', '/[?&]list=/']) {
    assert.ok(head.includes(piece), `index.html: ${piece}`);
  }
  const { firstVisit } = await import('../../src/startup.js');
  assert.equal(firstVisit(), false); // no window: a script, not a visit
});

test('a distance is written with the decimal mark of the language', async () => {
  const { default: i18next } = await import('i18next');
  const { formatDistance } = await import('../../src/utils.js');
  const before = i18next.language;
  assert.equal(formatDistance(1.94), '1.9 km');
  assert.equal(formatDistance(0.3), '300 m');
  await i18next.changeLanguage('id');
  assert.equal(formatDistance(1.94), '1,9 km');
  assert.equal(formatDistance(12.4), '12 km');
  await i18next.changeLanguage(before);
});

test('the page is marked with the language from the start, except the pages written out in English', () => {
  assert.equal(visit({ languages: ['ja'] }).pageLang, 'ja');
  assert.equal(visit({ languages: ['zh-TW'], pathname: '/cards' }).pageLang, 'zh-Hant');
  assert.equal(visit({ languages: ['ko'], pathname: '/place/balwoo' }).pageLang, 'en');
  assert.equal(visit({ languages: ['ko'], pathname: '/find/vegan/' }).pageLang, 'en');
});

test('labels joined in code take the marks of the language', async () => {
  const { default: i18next } = await import('i18next');
  const { setLanguage } = await import('../../src/i18n/index.js');
  const { colon, paren } = await import('../../src/i18n/punct.js');
  const before = i18next.language;
  assert.equal(colon('Copy', 'Seoul'), 'Copy: Seoul');
  assert.equal(paren('Saved', 3), 'Saved (3)');
  assert.equal(paren('', 3), ' (3)');
  for (const lang of ['ja', 'zh-Hans', 'zh-Hant']) {
    await setLanguage(lang, { remember: false });
    assert.equal(colon('コピー', 'ソウル'), 'コピー：ソウル', lang);
    assert.equal(paren('保存済み', 3), '保存済み（3）', lang);
  }
  for (const lang of ['ko', 'id', 'en']) {
    await setLanguage(lang, { remember: false });
    assert.equal(paren('A', 'b'), 'A (b)', lang);
    assert.equal(colon('A', 'b'), 'A: b', lang);
  }
  await setLanguage(before, { remember: false });
});

test("the app's own step back is told from the reader's, once", async () => {
  const { ownBack, takeOwnBack } = await import('../../src/ownBack.js');
  assert.equal(takeOwnBack(), false);
  ownBack();
  assert.equal(takeOwnBack(), true);
  assert.equal(takeOwnBack(), false); // the next Back is the reader's
  ownBack();
  await new Promise(resolve => setTimeout(resolve, 1700));
  assert.equal(takeOwnBack(), false); // no event came: not kept for a later Back
});

test("the loading screen's tagline is the welcome screen's headline in each language", async () => {
  const body = scripts.find(s => s.includes('data-tagline'));
  assert.ok(body, 'no script sets the tagline');
  for (const { code, load } of LANGUAGES) {
    if (!load) continue;
    const locale = (await load()).default;
    const headline = locale.prologue.title.replace(/[.。]$/, '');
    assert.ok(body.includes(JSON.stringify(headline)), `${code}: ${headline}`);
  }
});

test('"near" beside a landmark is said in the language of the reader', async () => {
  const { nearIn } = await import('../../src/place-area.js');
  assert.equal(nearIn('Choryang-dong, Dong-gu, Busan (near Busan Station)', 'ja'), 'Choryang-dong, Dong-gu, Busan (Busan Station 付近)');
  assert.equal(nearIn('Daeheung-dong, Dongnam-gu, Cheonan (by Cheonan Station)', 'id'), 'Daeheung-dong, Dongnam-gu, Cheonan (dekat Cheonan Station)');
  assert.equal(nearIn('Eojin-dong, Sejong (near the Government Complex Sejong)', 'zh-Hans'), 'Eojin-dong, Sejong (Government Complex Sejong 附近)');
  // A description in plain English, another kind of bracket, English itself: untouched.
  for (const z of ['Ora 1-dong, Jeju City (near the intercity bus terminal)', 'Itaewon-dong, Yongsan-gu, Seoul (Itaewon)']) assert.equal(nearIn(z, 'ja'), z);
  assert.equal(nearIn('Gyeong-dong, Mokpo (near Mokpo Station)', 'en'), 'Gyeong-dong, Mokpo (near Mokpo Station)');
});
