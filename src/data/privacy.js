// The privacy policy, in English and Korean, shown together on /privacy.
//
// Every statement here was measured against the code on 2026-09-29, not
// assumed: localStorage keys (App.jsx, i18n/index.js, Prologue.jsx,
// data/auth.js, data/passport.js), the hosts the browser contacts (the
// typeface is self-hosted since 2026-09-29 — no font host; MapComponent TileLayer — OpenStreetMap since 2026-09-28, CARTO
// before that, SubmitSheet, Supabase Auth for sign-in and passport sync),
// and the absence of analytics and cookies. Location (2026-10-02): asked only
// when “My location” is pressed, used in the browser, never stored or sent to
// us — App.jsx `locate`, data/locate.js. If the app starts
// storing or sending something new, this file must change in the same
// commit — a policy that lags the code is a false claim.
//
// The two languages are written as parallel statements of the same facts,
// not as a translation pipeline, which is why this lives beside the other
// editorial content rather than in the i18n locale files.

// The address privacy requests reach. Set 2026-09-18 by the operator; while
// it was null the page said the address was not yet published rather than
// inventing one. It is shown publicly on /privacy, which is the point.
export const PRIVACY_CONTACT = 'rkdalsinha@gmail.com';

export const PRIVACY_EFFECTIVE_DATE = '2026-10-02';

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
          'You can use K-Food Map without an account. If you don’t sign in, nothing below about accounts or signing in applies — the rest of this page still does, because sending a report, hosting and map images do not wait for an account.',
          'We do not run analytics, show ads, or set cookies. Your location is used only if you press “My location” on the map, and then only inside your browser, to centre the map and show distances from you — it is not stored and not sent to us.',
          'If you sign in with Google, Supabase (our authentication provider) stores your email address and account ID, and your account holds which places you saved or marked visited, and when — never your name, coordinates, photos, or location.',
          'We also receive personal information if you choose to send a report and include your email address.',
        ],
      },
      {
        heading: 'Stored on your device',
        items: [
          'Signed out, the app keeps four things in your browser’s local storage: the places you saved or marked as visited, with the dates you did so — unsaving a place does not delete this entry, it keeps it marked as unsaved so the place does not quietly reappear later; whether you finished the welcome screens; your language choice; and, if a sign-in on this device has ended on its own — an expired or revoked sign-in, or a sign-out in another tab — a flag recording that, kept only so the app can explain why your saved places are gone, and removed the next time you sign in. None of it is sent to us.',
          'Pressing “Sign in” writes a fifth before any account session exists: a short-lived code the sign-in exchange needs (`kfm-auth-code-verifier`), removed when the sign-in completes and left behind until the next attempt if you abandon it.',
          'Once you are signed in, two more things are added: your Supabase session, and which account’s places are on this device — and the places, visits, and unsaved-place records you have are then kept in sync with your account, so signing out erases them from that device while your account keeps them.',
          'Clearing this site’s data in your browser deletes everything local storage holds, whether or not you are signed in.',
          'For offline use, the browser also stores the app’s own files, and the full details of the places you have opened or saved, so those pages work without a connection. These are the same public pages anyone can open; they stay on your device and are never sent to us, though together they show which places you looked at — clearing this site’s data removes them.',
        ],
      },
      {
        heading: 'Signing in',
        text: 'Signing in is optional and uses your Google account, through Supabase Auth. Supabase stores the email address and account ID Google gives us. While you are signed in, your account holds which places you saved or marked visited, and when — nothing else: no name, no coordinates, no photos, no location. If you saved places on this device before signing in, they join your account the first time you sign in — which is also why signing out clears the device: on a shared or borrowed device, without that, the next person to sign in would inherit them too. Unsaving a place does not remove it from your account: it keeps a row recording that you unsaved it, and when, so the place cannot quietly reappear later — that row is kept until you delete it. Signing out, on this device or by a session simply ending (an expired or revoked sign-in, or signing out on another tab or device), erases those places from this device; your account keeps them until you delete them. Profile’s “Delete my saved places” deletes every saved, visited, and unsaved-place record your account holds, and clears this device. It cannot reach another device: one where you are still signed in keeps its own copy and will upload it to your account on its next sync, so sign out there first if you want the account to stay empty. This does not delete your Google account, and it does not delete the sign-in record this app holds for it (your email address and account ID): to have that record removed, write to the address below.',
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
          'Supabase Inc. (United States) stores the reports you send, and — if you sign in — your account (email address, account ID) and the places you saved or marked visited. Your browser also asks Supabase directly, even signed out, whether Google sign-in is turned on, which sends Supabase your IP address but no other information about you.',
          'Google LLC (United States), through Supabase, is who you sign in with if you choose to. Google gives Supabase your email address and account ID; we never see your Google password.',
          'OpenStreetMap provides the map images. Your browser requests them directly, which sends OpenStreetMap your IP address and, as with any map, which area you are looking at — after “My location”, that is the area around you. The typeface (Pretendard GOV) is served from this site itself, not from a font service.',
          'Links to Google Maps, Naver Map, Kakao Map, and restaurant websites take you to those services; their own privacy policies apply there.',
        ],
      },
      {
        heading: 'Your choices',
        text: 'You can ask us to show, correct, or delete a report you sent or the email address attached to it. You can delete everything stored on your device yourself at any time. If you are signed in, Profile’s “Delete my saved places” deletes your saved, visited, and unsaved-place records from your account and this device — but another device where you are still signed in can upload what it still holds, so sign out there first. That does not delete your Google account, and it does not delete the sign-in record this app holds for it (your email address and account ID): to have that record removed, write to the address below.',
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
          'K-Food Map은 회원가입 없이 이용할 수 있습니다. 로그인하지 않으면 계정·로그인에 관한 아래 내용은 해당하지 않지만, 그 밖의 내용은 그대로 적용됩니다 — 제보 전송, 호스팅과 지도 이미지는 계정과 무관하게 이루어집니다.',
          '이용 분석 도구·광고·쿠키를 사용하지 않습니다. 위치 정보는 지도에서 “내 위치”를 누른 경우에만, 지도를 그 위치로 옮기고 이용자로부터의 거리를 표시하기 위해 브라우저 안에서만 사용합니다 — 저장하지 않으며 운영자에게 전송하지 않습니다.',
          'Google 계정으로 로그인하면 인증을 담당하는 Supabase가 이메일 주소와 계정 ID를 저장하며, 계정에는 이용자가 저장하거나 방문 표시한 장소와 그 시각이 함께 보관됩니다 — 이름·좌표·사진·위치 정보는 포함되지 않습니다.',
          '이용자가 제보를 보내면서 이메일 주소를 적은 경우에도 개인정보를 받습니다.',
        ],
      },
      {
        heading: '이용자 기기에 저장되는 정보',
        items: [
          '로그인하지 않은 상태에서 앱은 브라우저의 로컬 저장소에 네 가지를 보관합니다: 저장하거나 방문 표시한 장소와 그 날짜 — 저장 해제한 장소는 삭제되지 않고 "저장 해제됨"으로 표시된 채 남아, 나중에 조용히 다시 나타나지 않도록 합니다; 첫 안내 화면 완료 여부; 선택한 언어; 그리고 이 기기의 로그인이 스스로 종료된 적이 있다면(로그인 만료·해지, 또는 다른 탭에서의 로그아웃) 저장된 장소가 사라진 이유를 설명하기 위한 표시로, 다음 로그인 시 삭제됩니다. 이 정보는 운영자에게 전송되지 않습니다.',
          '“로그인”을 누르면 아직 세션이 생기기 전에 다섯 번째 항목이 기록됩니다: 로그인 교환에 필요한 임시 코드(`kfm-auth-code-verifier`)로, 로그인이 끝나면 삭제되고 중간에 그만두면 다음 시도 때까지 남습니다.',
          '로그인하면 두 가지가 더해집니다: Supabase 로그인 세션, 그리고 이 기기가 어느 계정의 장소를 보관하고 있는지를 나타내는 값 — 이후 저장·방문 표시한 장소와 저장 해제 기록은 계정과 동기화되며, 로그인을 해제하면 이 기기에서는 지워지고 계정에는 남습니다.',
          '브라우저에서 이 사이트의 데이터를 삭제하면 로그인 여부와 관계없이 로컬 저장소의 내용이 모두 지워집니다.',
          '오프라인 이용을 위해 브라우저는 앱 파일과, 이용자가 열어 보았거나 저장한 장소의 전체 정보도 저장해 두어 연결 없이도 그 페이지가 열리게 합니다. 이는 누구나 열 수 있는 공개 페이지와 같은 내용으로, 이용자의 기기에만 남고 운영자에게 전송되지 않지만, 모아 보면 이용자가 어떤 장소를 보았는지 드러납니다 — 이 사이트의 데이터를 삭제하면 함께 지워집니다.',
        ],
      },
      {
        heading: '로그인',
        text: '로그인은 선택 사항이며, Supabase Auth를 통한 Google 계정 로그인만 지원합니다. Supabase는 Google이 제공하는 이메일 주소와 계정 ID를 저장합니다. 로그인한 동안 계정에는 저장하거나 방문 표시한 장소와 그 시각만 보관됩니다 — 이름, 좌표, 사진, 위치 정보는 없습니다. 로그인하기 전 이 기기에서 저장한 장소가 있다면, 처음 로그인할 때 그 장소들이 계정에 합쳐집니다 — 로그아웃하면 기기가 비워지는 것도 같은 이유입니다: 그렇지 않으면 공용이거나 남에게 빌린 기기에서 다음 사람이 로그인할 때 그 장소들을 그대로 물려받게 됩니다. 장소를 저장 해제해도 계정에서 곧바로 삭제되지는 않습니다 — 언제 저장 해제했는지를 기록한 행이 남아, 그 장소가 조용히 다시 나타나지 않도록 합니다. 그 기록은 삭제하기 전까지 계속 남아 있습니다. 이 기기에서 로그아웃하거나 세션이 스스로 종료되면(로그인 만료·해지, 또는 다른 탭·기기에서의 로그아웃) 그 장소들은 이 기기에서 지워지며, 삭제하기 전까지는 계정에 남아 있습니다. 프로필의 "내 저장 장소 삭제"는 저장·방문·저장 해제 기록을 포함해 계정이 가진 모든 장소 기록을 삭제하고 이 기기도 함께 비웁니다. 다만 다른 기기에는 미치지 않습니다: 그쪽에서 여전히 로그인되어 있으면 그 기기가 보관한 기록이 다음 동기화 때 계정으로 다시 올라갑니다. 계정을 비운 상태로 두려면 그 기기에서 먼저 로그아웃해 주세요. 이때 이용자의 Google 계정은 삭제되지 않으며, 이 앱이 보관 중인 로그인 기록(이메일 주소, 계정 ID)도 삭제되지 않습니다 — 로그인 기록을 삭제하려면 아래 주소로 운영자에게 요청해 주세요.',
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
          'Supabase Inc.(미국)가 이용자가 보낸 제보를 저장하며, 로그인한 경우에는 계정 정보(이메일 주소, 계정 ID)와 저장·방문 표시한 장소도 저장합니다. 로그인하지 않은 상태에서도 브라우저는 Google 로그인이 켜져 있는지 확인하기 위해 Supabase에 직접 요청을 보내며, 이때 IP 주소가 전달되지만 그 밖의 정보는 전달되지 않습니다.',
          'Google LLC(미국)는 Supabase를 통해 이용자가 로그인을 선택할 경우의 로그인 제공자입니다. Google은 Supabase에 이메일 주소와 계정 ID를 전달하며, 저희는 이용자의 Google 비밀번호를 알 수 없습니다.',
          'OpenStreetMap이 지도 이미지를 제공합니다. 브라우저가 이를 직접 불러오므로 OpenStreetMap에 IP 주소와, 여느 지도와 마찬가지로 이용자가 보고 있는 지역이 전달됩니다 — “내 위치”를 누른 뒤에는 이용자 주변 지역입니다. 글꼴(Pretendard GOV)은 글꼴 서비스가 아니라 이 사이트에서 직접 제공합니다.',
          'Google 지도, 네이버 지도, 카카오맵, 식당 웹사이트로 연결되는 링크를 누르면 해당 서비스로 이동하며, 그곳에서는 각 서비스의 개인정보처리방침이 적용됩니다.',
        ],
      },
      {
        heading: '이용자의 권리',
        text: '보낸 제보나 함께 적은 이메일 주소의 열람, 정정, 삭제를 요청할 수 있습니다. 기기에 저장된 정보는 언제든 직접 삭제할 수 있습니다. 로그인한 경우, 프로필의 "내 저장 장소 삭제"는 저장·방문·저장 해제 기록을 포함해 계정과 이 기기의 장소 기록을 모두 삭제합니다 — 다만 여전히 로그인된 다른 기기가 보관한 기록을 다시 올릴 수 있으므로, 그 기기에서 먼저 로그아웃해 주세요. 이용자의 Google 계정 자체는 삭제되지 않으며, 이 앱이 보관 중인 로그인 기록(이메일 주소, 계정 ID)도 그대로 남습니다 — 로그인 기록을 삭제하려면 아래 주소로 연락해 주세요.',
      },
      {
        heading: '방침의 변경',
        text: '앱이 수집하는 정보가 바뀌면 이 페이지를 먼저 고치고 시행일을 새로 적습니다.',
      },
    ],
  },
};
