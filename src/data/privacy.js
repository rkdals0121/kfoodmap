// The privacy policy, in English and Korean, shown together on /privacy.
//
// Every statement here was measured against the code on 2026-09-18, not
// assumed: localStorage keys (App.jsx, i18n/index.js, Prologue.jsx), the
// hosts the browser contacts (index.css @import, MapComponent TileLayer,
// SubmitSheet), and the absence of analytics, cookies and geolocation. If
// the app starts storing or sending something new, this file must change in
// the same commit — a policy that lags the code is a false claim.
//
// The two languages are written as parallel statements of the same facts,
// not as a translation pipeline, which is why this lives beside the other
// editorial content rather than in the i18n locale files.

// The address privacy requests reach. Set 2026-09-18 by the operator; while
// it was null the page said the address was not yet published rather than
// inventing one. It is shown publicly on /privacy, which is the point.
export const PRIVACY_CONTACT = 'rkdalsinha@gmail.com';

export const PRIVACY_EFFECTIVE_DATE = '2026-09-18';

// scripts/leads.mjs purge-emails removes contact_email from leads older
// than this. The policy text below states the same number.
export const LEAD_EMAIL_RETENTION_DAYS = 365;

export const privacyPolicy = {
  en: {
    title: 'Privacy Policy',
    effective: `Effective ${PRIVACY_EFFECTIVE_DATE}`,
    contactPending: 'The contact address for privacy requests will be published here.',
    sections: [
      {
        heading: 'In short',
        items: [
          'You can use K-Food Map without an account.',
          'We do not use your location, run analytics, show ads, or set cookies.',
          'Your saved and visited places stay on your own device.',
          'We only receive personal information if you choose to send a report and include your email address.',
        ],
      },
      {
        heading: 'Stored on your device',
        text: 'The app keeps three things in your browser’s local storage: the places you saved or marked as visited, with the dates you did so; whether you finished the welcome screens; and your language choice. They are never sent to us. Clearing this site’s data in your browser deletes them. For offline use, the browser also stores the app’s own files — these contain no information about you.',
      },
      {
        heading: 'When you send a report',
        text: 'If you suggest a restaurant or report incorrect information, we receive what you type: the restaurant and roughly where it is, what the report is about, your message, an optional link, and an optional email address, together with the app language and the time of sending. While you type a restaurant name, from two characters on, the text you have typed so far is sent to Kakao Map to fetch matching places — whether or not you pick one. If you do pick a suggestion, the report also carries that place’s address and coordinates as Kakao Map has them. We use it only to check and correct restaurant information. Reports are never published as they are — a person verifies every one before anything on the map changes. Your email address is used only to ask you a follow-up question, is never shown publicly, and is never sold or shared for marketing.',
      },
      {
        heading: 'How long we keep it',
        text: `We keep the content of a report and our decision about it as part of the record of how restaurant information was checked. Your email address is deleted ${LEAD_EMAIL_RETENTION_DAYS / 365 === 1 ? 'one year' : `${LEAD_EMAIL_RETENTION_DAYS} days`} after you send the report, or earlier if you ask.`,
      },
      {
        heading: 'Services involved',
        items: [
          'Vercel Inc. (United States) hosts the app. Like any web host, it receives technical request data such as your IP address when you open the site.',
          'Kakao Corp. (Republic of Korea) provides the restaurant search shown while you type a name in the report form. The text you have typed is relayed to Kakao by our server, not sent directly from your browser, so Kakao does not receive your IP address.',
          'Supabase Inc. (United States) stores the reports you send.',
          'Google Fonts (Google LLC, United States) provides the typeface, and CARTO provides the map images. Your browser requests these directly, which sends them your IP address.',
          'Links to Google Maps, Naver Map, Kakao Map, and restaurant websites take you to those services; their own privacy policies apply there.',
        ],
      },
      {
        heading: 'Your choices',
        text: 'You can ask us to show, correct, or delete a report you sent or the email address attached to it. You can delete everything stored on your device yourself at any time.',
      },
      {
        heading: 'Changes',
        text: 'If what the app collects changes, this page will be updated first, with a new effective date.',
      },
    ],
  },
  ko: {
    title: '개인정보처리방침',
    effective: `시행일 ${PRIVACY_EFFECTIVE_DATE}`,
    contactPending: '개인정보 관련 문의처는 이곳에 게시될 예정입니다.',
    sections: [
      {
        heading: '요약',
        items: [
          'K-Food Map은 회원가입 없이 이용할 수 있습니다.',
          '위치 정보를 사용하지 않으며, 이용 분석 도구·광고·쿠키를 사용하지 않습니다.',
          '저장하거나 방문 표시한 장소는 이용자의 기기에만 보관됩니다.',
          '이용자가 제보를 보내면서 이메일 주소를 적은 경우에만 개인정보를 받습니다.',
        ],
      },
      {
        heading: '이용자 기기에 저장되는 정보',
        text: '앱은 브라우저의 로컬 저장소에 세 가지를 보관합니다: 저장하거나 방문 표시한 장소와 그 날짜, 첫 안내 화면 완료 여부, 선택한 언어. 이 정보는 운영자에게 전송되지 않으며, 브라우저에서 이 사이트의 데이터를 삭제하면 지워집니다. 오프라인 이용을 위해 브라우저가 앱 파일도 저장하지만, 여기에는 이용자에 관한 정보가 없습니다.',
      },
      {
        heading: '제보를 보낼 때 받는 정보',
        text: '식당을 추천하거나 잘못된 정보를 제보하면, 입력한 내용(식당과 대략의 위치, 제보 주제, 내용, 선택 입력한 링크, 선택 입력한 이메일 주소)과 앱 언어, 전송 시각을 받습니다. 식당 이름을 두 글자 이상 입력하는 동안, 그때까지 입력한 글자는 일치하는 장소를 찾기 위해 카카오맵으로 전송됩니다 — 항목을 선택하지 않더라도 마찬가지입니다. 추천 항목을 선택하면, 제보에 해당 장소의 주소와 좌표(카카오맵 기준)가 함께 포함됩니다. 이 정보는 식당 정보를 확인하고 바로잡는 목적으로만 이용합니다. 제보는 그대로 게시되지 않으며, 지도 정보가 바뀌기 전에 사람이 모든 제보를 검증합니다. 이메일 주소는 추가 확인이 필요할 때 연락하는 용도로만 쓰이고, 공개되지 않으며, 판매하거나 마케팅 목적으로 제공하지 않습니다.',
      },
      {
        heading: '보유 기간',
        text: `제보 내용과 그에 대한 처리 결과는 식당 정보를 어떻게 검증했는지에 대한 기록으로 보관합니다. 이메일 주소는 제보를 보낸 날로부터 ${LEAD_EMAIL_RETENTION_DAYS / 365 === 1 ? '1년' : `${LEAD_EMAIL_RETENTION_DAYS}일`} 후, 또는 요청하는 경우 그 전에 삭제합니다.`,
      },
      {
        heading: '관련 서비스 (처리 위탁 및 국외 이전)',
        items: [
          'Vercel Inc.(미국)가 앱을 호스팅합니다. 사이트에 접속하면 일반적인 웹 호스팅과 마찬가지로 IP 주소 등 접속 기술 정보를 받습니다.',
          '카카오 주식회사(대한민국)가 제보 양식에서 식당 이름을 입력하는 동안 보여지는 장소 검색을 제공합니다. 입력한 글자는 이용자의 브라우저가 아니라 저희 서버를 통해 카카오로 전달되므로, 카카오는 이용자의 IP 주소를 받지 않습니다.',
          'Supabase Inc.(미국)가 이용자가 보낸 제보를 저장합니다.',
          'Google Fonts(Google LLC, 미국)가 글꼴을, CARTO가 지도 이미지를 제공합니다. 브라우저가 이를 직접 불러오므로 해당 서비스에 IP 주소가 전달됩니다.',
          'Google 지도, 네이버 지도, 카카오맵, 식당 웹사이트로 연결되는 링크를 누르면 해당 서비스로 이동하며, 그곳에서는 각 서비스의 개인정보처리방침이 적용됩니다.',
        ],
      },
      {
        heading: '이용자의 권리',
        text: '보낸 제보나 함께 적은 이메일 주소의 열람, 정정, 삭제를 요청할 수 있습니다. 기기에 저장된 정보는 언제든 직접 삭제할 수 있습니다.',
      },
      {
        heading: '방침의 변경',
        text: '앱이 수집하는 정보가 바뀌면 이 페이지를 먼저 고치고 시행일을 새로 적습니다.',
      },
    ],
  },
};
