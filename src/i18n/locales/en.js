// English strings for the four "core screens" extracted so far (see
// docs/superpowers/specs/2026-08-03-multilingual-infra-design.md for the
// full extraction-scope rationale). This is the one file a future
// session extends when a second language ships -- add a sibling file
// (e.g. ko.js) with the same key shape and register it in ../index.js.
export default {
  tabBar: {
    map: 'Map',
    discover: 'Discover',
    journal: 'Journal',
    profile: 'Profile',
  },
  prologue: {
    welcomeTitle: 'Welcome to Korea.',
    welcomeSubtitle: 'Discover food that matches your taste.',
    trustLine: '{{activeCount}} restaurants, researched one at a time — every claim sourced, or marked honestly unknown.',
    continue: 'Continue',
    storiesTitle: 'Explore Korean food stories.',
    storiesSubtitle: 'Every restaurant has a cultural story.',
    next: 'Next',
    locationTitle: 'Allow location',
    locationSubtitle: 'To find the best places near you.',
    allowLocation: 'Allow While Using App',
    skipForNow: 'Skip for now',
    findingTitle: 'Finding restaurants near you...',
  },
  trust: {
    unknown: 'Unknown',
    unknownDetail: 'Not established.',
    official: 'Official',
    officialDetail: 'Confirmed against an official registry.',
    communityChecked: 'Community-checked',
    communityCheckedDetail: 'Reported by travellers and checked by us.',
    confirmed: 'Confirmed',
    confirmedDetail: 'Confirmed with the restaurant.',
    reported: 'Reported',
    reportedDetail: 'Stated by a source, not yet confirmed. {{evidence}}',
    inferred: 'Inferred',
    inferredDetail: 'Our reading, not a stated fact. {{evidence}}',
  },
  dietary: {
    veganFull: 'Fully vegan',
    veganOptions: 'Vegan options',
    halalCertified: 'Halal certified',
    halalFriendly: 'Halal-friendly',
    porkFree: 'Pork-free',
  },
  journal: {
    firstTaste: 'First Taste',
    plantBased: 'Plant Based',
    sample: 'Sample',
    whatItllLookLike: "What it'll look like",
    step1: 'Find a restaurant you like',
    step2: 'Tap the heart to save it',
    step3: 'Mark it visited after your trip',
  },
  profile: {
    language: 'Language',
    languageEnglish: 'English',
  },
};
