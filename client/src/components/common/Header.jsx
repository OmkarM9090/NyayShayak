import { Scale, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext.jsx';

export default function Header() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { language, setLanguage, languages } = useLanguage();
  const storedUser = localStorage.getItem('user');
  const user = storedUser ? JSON.parse(storedUser) : null;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <header className="h-16 border-b border-white/5 bg-[#0d0d0f] flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-3">
        <div className="p-1.5 bg-indigo-600 rounded-lg">
          <Scale size={20} className="text-white" />
        </div>
        <Link title="Home" to="/chat" className="font-serif font-bold text-lg text-white tracking-tight hover:opacity-80 transition">
          {t('appName')}
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          className="rounded-lg border border-white/10 bg-[#0d0d0f] px-3 py-2 text-xs font-semibold text-white outline-none focus:border-indigo-500"
          aria-label={t('settings.language')}
        >
          {languages.map((item) => (
            <option key={item.code} value={item.code}>
              {item.label}
            </option>
          ))}
        </select>
        {user ? (
          <div className="flex items-center gap-3 pl-4 border-l border-white/10">
            <div className="flex flex-col items-end hidden sm:flex">
              <span className="text-xs font-bold text-white">{user.name}</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">{t('header.plan')}</span>
            </div>
            <button onClick={handleLogout} className="p-2 hover:bg-red-500/10 hover:text-red-400 rounded-lg text-slate-400 transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <Link to="/login" className="text-sm font-bold bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-500 transition">
            {t('auth.signIn')}
          </Link>
        )}
      </div>
    </header>
  );
}
