import { useState, useContext } from 'react';
import { Menu, X } from 'lucide-react';
import { LanguageContext } from '../context/LanguageContext';

export function BottomMenu() {
    const { language, setLanguage, t } = useContext(LanguageContext);
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="fixed bottom-4 left-4 z-40 text-sm">
            {!isOpen ? (
                <button 
                  onClick={() => setIsOpen(true)}
                  className="bg-slate-800 text-cyan-400 p-2 rounded-full border border-cyan-700 shadow-lg hover:bg-slate-700"
                >
                    <Menu className="w-6 h-6"/>
                </button>
            ) : (
                <div className="bg-slate-900 text-cyan-100 p-6 rounded-xl border border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)] w-80 text-base font-mono flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <h4 className="font-bold text-cyan-300 text-lg">{t('menu')}</h4>
                        <button onClick={() => setIsOpen(false)}><X className="w-6 h-6"/></button>
                    </div>
                    
                    <select 
                        value={language}
                        onChange={(e) => setLanguage(e.target.value as 'pt' | 'fr' | 'en')}
                        className="bg-slate-950 border border-cyan-700 p-2 rounded text-sm text-cyan-200 cursor-pointer"
                    >
                        <option value="pt">Português</option>
                        <option value="fr">Français</option>
                        <option value="en">English</option>
                    </select>

                    <div className="text-xs text-cyan-600 bg-slate-950 p-3 rounded border border-cyan-900 border-dashed">
                        {t('apk_notice')}
                    </div>

                    <div className="text-xs text-slate-400 border-t border-cyan-800 pt-3">
                        {t('developer')}<br/>
                        {t('contact')}<br/>
                        {t('gps')}
                    </div>
                </div>
            )}
        </div>
    );
}
