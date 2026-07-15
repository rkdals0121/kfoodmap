const fs = require('fs');

const data = JSON.parse(fs.readFileSync('./src/data/restaurants.json', 'utf8'));

const locations = ['Seoul', 'Incheon'];
const filters = ['Vegan', 'Halal', 'Mild Taste', 'Zero Waste', 'Fermented'];

console.log('=== 1. 최종 식당 수 (집계표) ===');
console.log(`Total: ${data.length}`);
locations.forEach(loc => {
  const locData = data.filter(r => r.location_zone.includes(loc));
  console.log(`${loc}: ${locData.length}`);
});
console.log('---');
filters.forEach(f => {
  const fData = data.filter(r => r.filters.includes(f));
  console.log(`${f}: ${fData.length}`);
});

console.log('\n=== 2. 지역×필터 10가지 조합 테스트 ===');
let hasZero = false;
locations.forEach(loc => {
  filters.forEach(f => {
    const count = data.filter(r => r.location_zone.includes(loc) && r.filters.includes(f)).length;
    console.log(`${loc} x ${f}: ${count}`);
    if (count === 0) hasZero = true;
  });
});
console.log(`결과 0개인 조합 존재 여부: ${hasZero}`);
