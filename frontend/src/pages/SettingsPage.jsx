import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function SettingsPage() {
  const { t } = useTranslation();
  const { language, setLanguage, languages } = useLanguage();
  return (
    <main className="flex-1 p-8 bg-brand-base text-brand-primary overflow-y-auto">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-serif font-bold mb-8">{t('settings.title')}</h1>
        
        <div className="bg-white rounded-2xl shadow-sm border border-brand-surface p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">{t('settings.preferences')}</h2>
          <div className="flex items-center justify-between py-3 border-b border-brand-surface/50">
            <span>{t('settings.language')}</span>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="bg-brand-base border border-brand-surface rounded p-1 outline-none focus:ring-2 focus:ring-brand-accent"
            >
              {languages.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </main>
  );
}