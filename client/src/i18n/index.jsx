import { createContext, useContext, useState, useEffect } from 'react';
import ja from './ja.json';
import en from './en.json';

const translations = { ja, en };

const I18nContext = createContext();

function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

function detectLanguage() {
  const lang = navigator.language || navigator.userLanguage || 'en';
  return lang.startsWith('ja') ? 'ja' : 'en';
}

export function I18nProvider({ children }) {
  const [locale, setLocale] = useState(detectLanguage);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  function t(key, params) {
    let text = getNestedValue(translations[locale], key) || getNestedValue(translations.en, key) || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
      });
    }
    return text;
  }

  return (
    <I18nContext.Provider value={{ t, locale, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
