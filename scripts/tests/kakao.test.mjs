import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateQuery, kakaoSearchUrl, mapKakaoDocuments, MIN_QUERY, MAX_QUERY, RESULT_LIMIT } from '../../api/_lib/kakao.mjs';

test('validateQuery trims, and enforces the documented bounds', () => {
  assert.deepEqual(validateQuery('  공화춘  '), { ok: true, query: '공화춘' });
  assert.deepEqual(validateQuery('가'), { ok: false, code: 'tooShort' });
  assert.deepEqual(validateQuery('   '), { ok: false, code: 'tooShort' });
  assert.deepEqual(validateQuery(undefined), { ok: false, code: 'tooShort' });
  assert.deepEqual(validateQuery('x'.repeat(MAX_QUERY)), { ok: true, query: 'x'.repeat(MAX_QUERY) });
  assert.deepEqual(validateQuery('x'.repeat(MAX_QUERY + 1)), { ok: false, code: 'tooLong' });
  assert.equal(MIN_QUERY, 2);
});

test('kakaoSearchUrl asks Kakao for exactly the documented request', () => {
  const url = new URL(kakaoSearchUrl('공화춘'));
  assert.equal(url.origin + url.pathname, 'https://dapi.kakao.com/v2/local/search/keyword.json');
  assert.equal(url.searchParams.get('query'), '공화춘');
  assert.equal(url.searchParams.get('size'), String(RESULT_LIMIT));
});

const payload = {
  documents: [
    {
      id: '12345', place_name: '공화춘', address_name: '인천 중구 선린동 38-1',
      road_address_name: '인천 중구 차이나타운로 43', x: '126.6173', y: '37.4746',
      category_name: '음식점 > 중식', phone: '032-765-0571', place_url: 'http://place.map.kakao.com/12345',
    },
    {
      id: '67890', place_name: '이름만 지번', address_name: '서울 용산구 이태원동 1',
      road_address_name: '', x: '127.0', y: '37.5', category_name: '음식점',
    },
  ],
};

test('mapKakaoDocuments keeps only the fields we use, road address first', () => {
  const rows = mapKakaoDocuments(payload);
  assert.deepEqual(rows[0], {
    id: '12345', name: '공화춘', address: '인천 중구 차이나타운로 43',
    lat: 37.4746, lng: 126.6173, category: '음식점 > 중식',
  });
  assert.equal(rows[1].address, '서울 용산구 이태원동 1', 'falls back to the lot address');
  assert.equal(rows.some(r => 'phone' in r || 'place_url' in r), false, 'phone and place_url are not collected');
});

test('mapKakaoDocuments never throws on a malformed payload', () => {
  for (const bad of [null, undefined, {}, { documents: null }, { documents: [{}] }, { documents: [{ id: 'x', x: 'abc', y: 'def' }] }]) {
    assert.ok(Array.isArray(mapKakaoDocuments(bad)));
  }
  assert.deepEqual(mapKakaoDocuments({ documents: [{ id: 'x', place_name: 'n', x: 'abc', y: 'def' }] }), []);
});

test('mapKakaoDocuments caps the list even if Kakao returns more', () => {
  const many = { documents: Array.from({ length: 15 }, (_, i) => ({ id: String(i), place_name: `n${i}`, address_name: 'a', x: '127', y: '37', category_name: 'c' })) };
  assert.equal(mapKakaoDocuments(many).length, RESULT_LIMIT);
});
