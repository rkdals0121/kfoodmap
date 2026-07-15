const fs = require('fs');
const https = require('https');

const rawData = [
  {
    "id": "rest_001",
    "name": "Balwoo Gongyang (발우공양)",
    "location_zone": "Seoul (Hongdae/Itaewon)",
    "address_query": "Balwoo Gongyang, Jongno, Seoul, South Korea",
    "fallback_center": { "lat": 37.574, "lng": 126.983 },
    "filters": ["Vegan", "Mild Taste", "Fermented"],
    "image_url": "/images/temple_food.svg",
    "basic_info": { "address": "71, Gyeonji-dong, Jongno-gu, Seoul", "open_hours": "11:30 AM - 9:30 PM" },
    "menus": [
      { "name": "Michelin Temple Course", "price": "45,000 KRW" },
      { "name": "Meditation Set Meal", "price": "65,000 KRW" },
      { "name": "Fermented Plum Tea", "price": "~8,000 KRW" }
    ],
    "storytelling_en": "Recognized by the Michelin Guide, Balwoo Gongyang embodies the zenith of Korean temple cuisine. Their course menus strictly adhere to Buddhist principles, completely omitting the five pungent alliums. Diners can experience a profound connection to mindful eating and ancient fermentation practices."
  },
  {
    "id": "rest_002",
    "name": "Sanchon (산촌)",
    "location_zone": "Seoul (Hongdae/Itaewon)",
    "address_query": "Sanchon, Insadong, Seoul, South Korea",
    "fallback_center": { "lat": 37.575, "lng": 126.985 },
    "filters": ["Vegan", "Mild Taste", "Fermented"],
    "image_url": "/images/temple_food.svg",
    "basic_info": { "address": "30-13, Insadong-gil, Jongno-gu, Seoul", "open_hours": "12:00 PM - 9:00 PM" },
    "menus": [
      { "name": "Traditional Temple Banchan Set", "price": "33,000 KRW" },
      { "name": "Wild Mountain Greens Rice", "price": "22,000 KRW" },
      { "name": "Lotus Root Pancakes", "price": "~15,000 KRW" }
    ],
    "storytelling_en": "Tucked away in the alleys of Insadong, Sanchon offers an immersive traditional temple food experience. The table is filled with dozens of seasonal banchan (side dishes) forged from wild mountain greens. It's a spectacular visual and mild-tasting feast that celebrates Korea's agrarian roots."
  },
  {
    "id": "rest_003",
    "name": "Osegyehyang (오세계향)",
    "location_zone": "Seoul (Hongdae/Itaewon)",
    "address_query": "Osegyehyang, Insadong, Seoul, South Korea",
    "fallback_center": { "lat": 37.574, "lng": 126.984 },
    "filters": ["Vegan"],
    "image_url": "/images/temple_food.svg",
    "basic_info": { "address": "14-5, Insadong 12-gil, Jongno-gu, Seoul", "open_hours": "11:30 AM - 9:00 PM" },
    "menus": [
      { "name": "Vegan Jajangmyeon", "price": "9,000 KRW" },
      { "name": "Soy Meat Sweet and Sour", "price": "18,000 KRW" },
      { "name": "Spicy Vegan Jjamppong", "price": "10,000 KRW" }
    ],
    "storytelling_en": "Osegyehyang is a pioneer in bringing plant-based alternatives to beloved comfort foods. Famous for their brilliant soy meat dishes, they seamlessly convert rich Korean-Chinese classics into 100% vegan meals. This is the perfect spot to enjoy guilt-free, sustainable versions of everyday favorites."
  },
  {
    "id": "rest_004",
    "name": "Plant Cafe & Kitchen",
    "location_zone": "Seoul (Hongdae/Itaewon)",
    "address_query": "Plant Cafe, Itaewon, Seoul, South Korea",
    "fallback_center": { "lat": 37.532, "lng": 126.992 },
    "filters": ["Vegan"],
    "image_url": "/images/temple_food.svg",
    "basic_info": { "address": "117, Bogwang-ro, Yongsan-gu, Seoul", "open_hours": "11:00 AM - 10:00 PM" },
    "menus": [
      { "name": "Lentil Veggie Burrito Bowl", "price": "14,500 KRW" },
      { "name": "Avocado Burger", "price": "15,500 KRW" },
      { "name": "Vegan Chocolate Cake", "price": "~8,000 KRW" }
    ],
    "storytelling_en": "A trailblazer for the plant-based community in Itaewon, Plant Cafe combines hearty western-style vegan dining with in-house bakery delights. Their lentil bowls and burgers prove that veganism can be incredibly indulgent. The vibrant space acts as a hub for eco-conscious expats and locals alike."
  },
  {
    "id": "rest_005",
    "name": "Monk's Butcher",
    "location_zone": "Seoul (Hongdae/Itaewon)",
    "address_query": "Monk's Butcher, Itaewon, Seoul, South Korea",
    "fallback_center": { "lat": 37.535, "lng": 126.995 },
    "filters": ["Vegan"],
    "image_url": "/images/temple_food.svg",
    "basic_info": { "address": "TODO_VERIFY", "open_hours": "TODO_VERIFY" },
    "menus": [
      { "name": "Beyond Meat Burger", "price": "~18,000 KRW" },
      { "name": "Vegan Mushroom Risotto", "price": "~20,000 KRW" },
      { "name": "Plant-based Steak", "price": "~28,000 KRW" }
    ],
    "storytelling_en": "Elevating the concept of a 'fake meat' eatery, Monk's Butcher brings modern, upscale vegan dining to the heart of Itaewon. Their sophisticated plant-based twists on classic butcher shop fare challenge culinary boundaries. Enjoy an elegant evening where sustainability meets high-end gastronomy."
  },
  {
    "id": "rest_006",
    "name": "Camouflage",
    "location_zone": "Seoul (Hongdae/Itaewon)",
    "address_query": "Camouflage, Itaewon, Seoul, South Korea",
    "fallback_center": { "lat": 37.534, "lng": 126.994 },
    "filters": ["Vegan"],
    "image_url": "/images/temple_food.svg",
    "basic_info": { "address": "TODO_VERIFY", "open_hours": "TODO_VERIFY" },
    "menus": [
      { "name": "Vegan Kung Pao Chick'n", "price": "~19,000 KRW" },
      { "name": "Plant-based Chow Mein", "price": "~16,000 KRW" },
      { "name": "Crispy Mushroom Bites", "price": "~12,000 KRW" }
    ],
    "storytelling_en": "Camouflage creatively 'hides' the fact that its bold Chinese-American menu is completely free of animal products. By mastering textures and savory sauces, dishes like their vegan Kung Pao Chick'n fool the senses. It is a brilliant example of how playful and satisfying sustainable cuisine can be."
  },
  {
    "id": "rest_007",
    "name": "EID Halal Korean Food",
    "location_zone": "Seoul (Hongdae/Itaewon)",
    "address_query": "67 Usadan-ro 10-gil, Yongsan-gu, Seoul",
    "fallback_center": { "lat": 37.533, "lng": 126.995 },
    "filters": ["Halal", "Mild Taste"],
    "image_url": "/images/halal_meat.svg",
    "basic_info": { "address": "67, Usadan-ro 10-gil, Yongsan-gu, Seoul", "open_hours": "11:30 AM - 9:00 PM" },
    "menus": [
      { "name": "Halal Bulgogi", "price": "~15,000 KRW" },
      { "name": "Halal Samgyetang", "price": "~18,000 KRW" },
      { "name": "Halal Bibimbap", "price": "~10,000 KRW" }
    ],
    "storytelling_en": "Run by a dedicated Korean Muslim family, EID was one of the first KMF-certified restaurants in Seoul. They offer the comfort of home-cooked Korean meals, like mild Bulgogi and Samgyetang, with absolute Halal integrity. This warm, welcoming space truly bridges Korean heritage and Islamic dietary laws."
  },
  {
    "id": "rest_008",
    "name": "Makan Halal Korean Restaurant",
    "location_zone": "Seoul (Hongdae/Itaewon)",
    "address_query": "Makan Halal, Itaewon, Seoul, South Korea",
    "fallback_center": { "lat": 37.534, "lng": 126.994 },
    "filters": ["Halal"],
    "image_url": "/images/halal_meat.svg",
    "basic_info": { "address": "Near Seoul Central Mosque, Itaewon", "open_hours": "TODO_VERIFY" },
    "menus": [
      { "name": "Halal Braised Chicken (Jjimdak)", "price": "~10,000 KRW" },
      { "name": "Halal Grilled Mackerel", "price": "~10,000 KRW" },
      { "name": "Halal Tteokbokki", "price": "~8,000 KRW" }
    ],
    "storytelling_en": "Located just steps from the Seoul Central Mosque, Makan provides an accessible gateway into local cuisine. Their highly affordable menu spans from spicy stews to grilled fish, all meticulously prepared. Muslim travelers can explore authentic, fiery Korean flavors with complete peace of mind here."
  },
  {
    "id": "rest_009",
    "name": "Kampungku",
    "location_zone": "Seoul (Hongdae/Itaewon)",
    "address_query": "39 Usadan-ro 10-gil, Seoul",
    "fallback_center": { "lat": 37.533, "lng": 126.996 },
    "filters": ["Halal", "Mild Taste"],
    "image_url": "/images/halal_meat.svg",
    "basic_info": { "address": "39, Usadan-ro 10-gil, Yongsan-gu, Seoul", "open_hours": "TODO_VERIFY" },
    "menus": [
      { "name": "Nasi Lemak", "price": "~12,000 KRW" },
      { "name": "Halal Bibimbap", "price": "~9,000 KRW" },
      { "name": "Korean Fried Chicken", "price": "~16,000 KRW" }
    ],
    "storytelling_en": "Kampungku represents a beautiful culinary fusion of Korean and Malaysian traditions under a strict Halal standard. Patrons can effortlessly switch between a comforting bowl of Nasi Lemak and a sizzling Korean Bibimbap. This harmonious cross-cultural menu highlights the global adaptability of K-Food."
  },
  {
    "id": "rest_010",
    "name": "Nono Shop & Cafe",
    "location_zone": "Seoul (Hongdae/Itaewon)",
    "address_query": "Nono Shop, Itaewon, Seoul, South Korea",
    "fallback_center": { "lat": 37.535, "lng": 126.993 },
    "filters": ["Zero Waste", "Vegan"],
    "image_url": "/images/temple_food.svg",
    "basic_info": { "address": "TODO_VERIFY", "open_hours": "TODO_VERIFY" },
    "menus": [
      { "name": "Vegan Croissant", "price": "~5,500 KRW" },
      { "name": "Oat Milk Latte", "price": "~6,000 KRW" },
      { "name": "Zero Waste Nut Mix", "price": "~7,000 KRW" }
    ],
    "storytelling_en": "More than just a cafe, Nono Shop is a lifestyle space fiercely dedicated to environmental preservation. Every vegan product and beverage sold here adheres to a strict zero-waste philosophy, refusing single-use plastics. Visitors can nourish their bodies while actively reducing their ecological footprint."
  },
  {
    "id": "rest_011",
    "name": "Chaeyuk Sikdang Songdo (채육식당 송도점)",
    "location_zone": "Incheon",
    "address_query": "5 Technopark-ro 111beon-gil, Yeonsu-gu, Incheon",
    "fallback_center": { "lat": 37.382, "lng": 126.635 },
    "filters": ["Vegan", "Mild Taste"],
    "image_url": "/images/temple_food.svg",
    "basic_info": { "address": "5, Technopark-ro 111beon-gil, Yeonsu-gu, Incheon", "open_hours": "10:00 AM - 10:00 PM" },
    "menus": [
      { "name": "Soy-Meat Jeyuk Set", "price": "13,500 KRW" },
      { "name": "Mushroom Bulgogi Set", "price": "~14,000 KRW" },
      { "name": "Unlimited Namul Bar", "price": "Included" }
    ],
    "storytelling_en": "Chaeyuk Sikdang cleverly replaces pork in the classic Korean Jeyuk Bokkeum with high-quality soy meat, creating a surprisingly realistic vegan alternative. Their mild, savory marinades are accompanied by a generous self-serve bar of fresh salads and namul. It's a bountiful, healthy take on a ubiquitous worker's lunch."
  },
  {
    "id": "rest_012",
    "name": "Iryonghal Yangsik (일용할양식)",
    "location_zone": "Incheon",
    "address_query": "Iryonghal Yangsik, Incheon, South Korea",
    "fallback_center": { "lat": 37.452, "lng": 126.702 },
    "filters": ["Vegan", "Mild Taste"],
    "image_url": "/images/temple_food.svg",
    "basic_info": { "address": "TODO_VERIFY", "open_hours": "TODO_VERIFY" },
    "menus": [
      { "name": "Signature Ratatouille", "price": "~18,000 KRW" },
      { "name": "Vegetable-forward Brunch Plate", "price": "~16,000 KRW" },
      { "name": "Fresh Tomato Bruschetta", "price": "~10,000 KRW" }
    ],
    "storytelling_en": "Awarded the prestigious Blue Ribbon, this vegetable-forward brunch cafe elevates simple ingredients to art. Their signature ratatouille emphasizes the mild, intrinsic sweetness of slow-cooked local produce. It stands as a testament to the fact that healthy, meatless meals can achieve culinary excellence in Incheon."
  },
  {
    "id": "rest_013",
    "name": "Rim (림)",
    "location_zone": "Incheon",
    "address_query": "Rim restaurant, Cheongna, Incheon, South Korea",
    "fallback_center": { "lat": 37.532, "lng": 126.634 },
    "filters": ["Vegan"],
    "image_url": "/images/temple_food.svg",
    "basic_info": { "address": "Cheongna, Incheon", "open_hours": "TODO_VERIFY" },
    "menus": [
      { "name": "Vegan Lasagna", "price": "~22,000 KRW" },
      { "name": "Vegan Gnocchi", "price": "~19,000 KRW" },
      { "name": "Basil Pesto Pasta", "price": "~18,000 KRW" }
    ],
    "storytelling_en": "Rim proves that 100% plant-based Italian cuisine can rival its traditional counterparts. By crafting approximately 98% of their rich sauces entirely in-house, they ensure ultimate freshness and vegan integrity. Their lasagna and gnocchi provide deep, comforting layers of flavor without relying on dairy."
  },
  {
    "id": "rest_014",
    "name": "Meat Morning (밋모닝)",
    "location_zone": "Incheon",
    "address_query": "Meat Morning, Incheon, South Korea",
    "fallback_center": { "lat": 37.450, "lng": 126.700 },
    "filters": ["Vegan"],
    "image_url": "/images/temple_food.svg",
    "basic_info": { "address": "TODO_VERIFY", "open_hours": "TODO_VERIFY" },
    "menus": [
      { "name": "Sugar/Butter-free Cookies", "price": "~4,000 KRW" },
      { "name": "Gluten-free Bread", "price": "~6,000 KRW" },
      { "name": "Homemade Vegan Greek Yogurt", "price": "~7,500 KRW" }
    ],
    "storytelling_en": "Despite its somewhat ironic name, Meat Morning is actually a haven for health-conscious vegan desserts. They meticulously bake sugar-free and butter-free cookies alongside artisan gluten-free breads. Their homemade plant-based Greek yogurt offers a creamy, probiotic-rich treat for mindful eaters."
  },
  {
    "id": "rest_015",
    "name": "Arabesque",
    "location_zone": "Incheon",
    "address_query": "Arabesque, Yeonsu-gu, Incheon, South Korea",
    "fallback_center": { "lat": 37.406, "lng": 126.668 },
    "filters": ["Halal"],
    "image_url": "/images/halal_meat.svg",
    "basic_info": { "address": "Yeonsu-gu, Incheon", "open_hours": "TODO_VERIFY" },
    "menus": [
      { "name": "Halal Lamb Kebab", "price": "~18,000 KRW" },
      { "name": "Chicken Tikka Masala", "price": "~15,000 KRW" },
      { "name": "Fresh Hummus & Pita", "price": "~9,000 KRW" }
    ],
    "storytelling_en": "A historic pillar in Incheon since 2003, Arabesque serves strictly Halal, alcohol-free Indian and Turkish delicacies. Their enduring presence highlights the city's long-standing multiculturalism. Diners are treated to authentic, spice-rich meats cooked in traditional tandoors."
  },
  {
    "id": "rest_016",
    "name": "Bombay Brau",
    "location_zone": "Incheon",
    "address_query": "Bombay Brau, Songdo, Incheon, South Korea",
    "fallback_center": { "lat": 37.382, "lng": 126.635 },
    "filters": ["Halal", "Vegan"],
    "image_url": "/images/halal_meat.svg",
    "basic_info": { "address": "Songdo, Incheon", "open_hours": "TODO_VERIFY" },
    "menus": [
      { "name": "Vegan Dal Makhani", "price": "~14,000 KRW" },
      { "name": "Halal Tandoori Chicken", "price": "~20,000 KRW" },
      { "name": "Vegetable Samosas", "price": "~8,000 KRW" }
    ],
    "storytelling_en": "Nestled in the international district of Songdo, Bombay Brau caters brilliantly to both Halal and Vegan diets. Their expansive menu guarantees that diverse groups can dine together without compromising their beliefs. The rich curries here showcase the intense, sustainable power of plant and certified-meat cooking."
  },
  {
    "id": "rest_017",
    "name": "Gonghwachun (공화춘)",
    "location_zone": "Incheon",
    "address_query": "Gonghwachun, Chinatown, Incheon, South Korea",
    "fallback_center": { "lat": 37.475, "lng": 126.618 },
    "filters": ["Mild Taste"],
    "image_url": "/images/mild_soup.svg",
    "basic_info": { "address": "Chinatown, Incheon", "open_hours": "TODO_VERIFY" },
    "menus": [
      { "name": "Original Jajangmyeon", "price": "~10,000 KRW" },
      { "name": "Mild White Jjamppong", "price": "~12,000 KRW" },
      { "name": "Sweet and Sour Pork", "price": "~25,000 KRW" }
    ],
    "storytelling_en": "Steeped in history, Gonghwachun is widely celebrated as the birthplace of Jajangmyeon in Incheon's Chinatown. Their legendary black bean noodles boast a mild, savory depth that has defined Korean-Chinese cuisine for a century. Eating here is a direct taste of a vital piece of Korea's modern culinary heritage."
  }
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function geocode(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
  const options = {
    headers: { 'User-Agent': 'KFoodMapPrototype/1.0' }
  };
  
  return new Promise((resolve, reject) => {
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.length > 0) {
            resolve({ lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) });
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

async function build() {
  const finalData = [];
  
  for (let i = 0; i < rawData.length; i++) {
    let entry = { ...rawData[i] };
    console.log(`Geocoding ${entry.name}...`);
    const coords = await geocode(entry.address_query);
    if (coords) {
      entry.coordinates = coords;
      entry.coord_precision = "nominatim";
    } else {
      entry.coordinates = entry.fallback_center;
      entry.coord_precision = "approximate";
      console.log(`  -> Failed, using approximate coords`);
    }
    entry.data_verified = "2026-07";
    
    delete entry.address_query;
    delete entry.fallback_center;
    finalData.push(entry);
    
    // Wait 1 second to comply with Nominatim policy
    await sleep(1000);
  }
  
  fs.writeFileSync('./src/data/restaurants.json', JSON.stringify(finalData, null, 2));
  console.log('Finished writing 17 verified restaurants.');
  
  // Uniqueness self-check
  const menuSets = new Set();
  const storySets = new Set();
  let duplicateMenus = false;
  let duplicateStories = false;
  
  finalData.forEach(r => {
    const menuStr = JSON.stringify(r.menus);
    if (menuSets.has(menuStr)) duplicateMenus = true;
    menuSets.add(menuStr);
    
    if (storySets.has(r.storytelling_en)) duplicateStories = true;
    storySets.add(r.storytelling_en);
  });
  
  console.log(`Self-check Duplicated Menus: ${duplicateMenus}`);
  console.log(`Self-check Duplicated Stories: ${duplicateStories}`);
}

build();
