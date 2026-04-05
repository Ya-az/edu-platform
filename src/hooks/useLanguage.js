import { useContext } from 'react';
import { LanguageContext } from '../context/language-context';

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }

  return context;
}

export default useLanguage;
