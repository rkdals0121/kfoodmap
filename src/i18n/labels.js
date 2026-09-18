// Display labels for strings that are also data identifiers.
//
// Filter chips are compared against r.traits (App.jsx), and source/method
// are stored on every fact in restaurants.js. Translating those values in
// place would silently match nothing, so the id stays and only the label
// moves. Lives here rather than in verification.js, which Node scripts
// import and which must stay free of UI concerns.
import i18next from 'i18next';
// Ensures the i18next singleton is initialized before t() is ever called from
// this module, whether the caller is a React component or a plain Node
// script (see src/i18n/index.js's own header for why this is needed).
import './index.js';

export const CHIP_GROUPS = [
  {
    labelKey: 'filters.groupDietary',
    chips: [
      { id: 'Vegan', labelKey: 'filters.vegan' },
      { id: 'Halal', labelKey: 'filters.halal' },
    ],
  },
  {
    labelKey: 'filters.groupSustainability',
    chips: [
      { id: 'Sustainability', labelKey: 'filters.sustainability' },
      { id: 'Zero-waste', labelKey: 'filters.zeroWaste' },
      { id: 'Local Sourcing', labelKey: 'filters.localSourcing' },
    ],
  },
  {
    labelKey: 'filters.groupDining',
    chips: [
      { id: 'Mild Taste', labelKey: 'filters.mildTaste' },
      { id: 'Fermented', labelKey: 'filters.fermented' },
    ],
  },
];

// Keyed by the value as stored in restaurants.js. A value with no entry
// falls back to itself (see sourceLabel), so data added before its label
// shows the English it already showed rather than a blank or a key name.
export const SOURCE_LABEL_KEYS = {
  'Naver Place / Kakao Map': 'provenance.sourceMaps',
  'Restaurant directory listing': 'provenance.sourceDirectory',
  'Project research': 'provenance.sourceResearch',
  'The restaurant': 'provenance.sourceOperator',
  'Government tourism site': 'provenance.sourceGovernment',
  'Neighbourhood centre placeholder': 'provenance.sourcePlaceholder',
  'Venue name or branding': 'provenance.sourceBranding',
  'Traveller reports': 'provenance.sourceTravellers',
};

export const METHOD_LABEL_KEYS = {
  'Naver Place and Kakao Map agree': 'provenance.methodMapCrosscheck',
  'Map service lookup': 'provenance.methodMapLookup',
  'Map service routing API': 'provenance.methodRouting',
  'Read from the operator’s own website': 'provenance.methodOperatorSite',
  'Read from a government listing': 'provenance.methodGovListing',
  'Independent sources agree': 'provenance.methodIndependent',
  'Read from a directory listing': 'provenance.methodDirectory',
};

const labelFor = (map) => (value) => {
  if (typeof value !== 'string' || value === '') return '';
  const key = map[value];
  return key ? i18next.t(key) : value;
};

export const sourceLabel = labelFor(SOURCE_LABEL_KEYS);
export const methodLabel = labelFor(METHOD_LABEL_KEYS);
