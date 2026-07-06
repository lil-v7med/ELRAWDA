import React, { createContext, useState, useEffect, useContext } from 'react';
import { translations, Language } from '../services/translations.js';
import api from '../services/api.js';

type Theme = 'light' | 'dark';

interface LanguageContextProps {
  language: Language;
  theme: Theme;
  dir: 'ltr' | 'rtl';
  t: (key: string) => string;
  setLanguage: (lang: Language, user?: any, onUpdateUser?: (u: any) => void) => Promise<void>;
  setTheme: (theme: Theme, user?: any, onUpdateUser?: (u: any) => void) => Promise<void>;
  syncPreferences: (user: any) => void;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Read initial states from localStorage or defaults
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('elrawda_language') as Language) || 'ar';
  });

  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('elrawda_theme') as Theme) || 'light';
  });

  const dir = language === 'ar' ? 'rtl' : 'ltr';

  // Apply changes to Document Element
  useEffect(() => {
    document.documentElement.setAttribute('lang', language);
    document.documentElement.setAttribute('dir', dir);
    localStorage.setItem('elrawda_language', language);
  }, [language, dir]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('elrawda_theme', theme);
  }, [theme]);

  // Sync state if user settings change on boot or login
  const syncPreferences = (user: any) => {
    if (!user) return;
    if (user.language && user.language !== language) {
      setLanguageState(user.language as Language);
    }
    if (user.theme && user.theme !== theme) {
      setThemeState(user.theme as Theme);
    }
  };

  // Set Language - save locally and API if user is logged in
  const setLanguage = async (lang: Language, user?: any, onUpdateUser?: (u: any) => void) => {
    setLanguageState(lang);
    if (user && onUpdateUser) {
      try {
        const res = await api.put('/auth/profile', {
          name: user.name,
          avatar: user.avatar,
          currency: user.currency,
          date_format: user.date_format,
          theme: theme,
          language: lang
        });
        onUpdateUser(res.data.user);
      } catch (err) {
        console.error('Failed to sync language to server profile:', err);
      }
    }
  };

  // Set Theme - save locally and API if user is logged in
  const setTheme = async (th: Theme, user?: any, onUpdateUser?: (u: any) => void) => {
    setThemeState(th);
    if (user && onUpdateUser) {
      try {
        const res = await api.put('/auth/profile', {
          name: user.name,
          avatar: user.avatar,
          currency: user.currency,
          date_format: user.date_format,
          theme: th,
          language: language
        });
        onUpdateUser(res.data.user);
      } catch (err) {
        console.error('Failed to sync theme to server profile:', err);
      }
    }
  };

  // Translation lookup helper
  const t = (key: string): string => {
    const term = translations[key];
    if (term) {
      return term[language] || key;
    }
    return key;
  };

  return (
    <LanguageContext.Provider value={{ language, theme, dir, t, setLanguage, setTheme, syncPreferences }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
