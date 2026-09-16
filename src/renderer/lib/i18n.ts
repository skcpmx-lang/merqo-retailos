/**
 * Bangla-first i18n — all UI text via translation keys
 * No hard-coded strings in components
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import bnCommon from '../locales/bn/common.json';
import bnApp from '../locales/bn/app.json';
import enCommon from '../locales/en/common.json';
import enApp from '../locales/en/app.json';

const resources = {
  bn: {
    common: bnCommon,
    app: bnApp,
  },
  en: {
    common: enCommon,
    app: enApp,
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'bn', // Bangla-first
    fallbackLng: 'bn',
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
