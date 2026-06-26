import React, { createContext, useState, useEffect } from 'react';

type Language = 'pt' | 'fr' | 'en';

export const translations = {
    pt: {
        menu: 'Menu',
        apk_notice: 'Este apk esta em desenvolvimento, primeira regra nao sai do painel ou do navegador enquanto estiver na chamada.',
        developer: 'Desenvolvido pelo IT Nelson Zua',
        contact: 'CONTACTO: 935142914',
        gps: 'GPS: Soyo-Zaire- Angola',
        chat: 'Chat',
        set_name: 'Definir Seu Nome',
        enter_name: 'Digite seu nome...',
        save: 'Salvar',
        recipient: 'Destinatário (opcional)...',
        type_message: 'Digite a mensagem...',
        send: 'Enviar',
        select: 'Selecionar',
        delete_selected: 'Excluir Selecionados',
        cancel: 'Cancelar',
        close: 'Fechar',
        name: 'Nome',
        id: 'ID',
        share_id: 'Compartilhar ID',
        change_name: 'Mudar Nome',
        user_exists: 'Este usuário já existe',
        anonymous: 'Anónimo'
    },
    fr: {
        menu: 'Menu',
        apk_notice: 'Cette application est en développement, la règle principale est de ne pas quitter le panneau ou le navigateur pendant l\'appel.',
        developer: 'Développé par IT Nelson Zua',
        contact: 'CONTACT: 935142914',
        gps: 'GPS: Soyo-Zaire- Angola',
        chat: 'Chat',
        set_name: 'Définir votre nom',
        enter_name: 'Entrer un nom...',
        save: 'Enregistrer',
        recipient: 'Destinataire (optionnel)...',
        type_message: 'Taper un message...',
        send: 'Envoyer',
        select: 'Sélectionner',
        delete_selected: 'Supprimer la sélection',
        cancel: 'Annuler',
        close: 'Fermer',
        name: 'Nom',
        id: 'ID',
        share_id: 'Partager ID',
        change_name: 'Changer de nom',
        user_exists: 'Cet utilisateur existe déjà',
        anonymous: 'Anonyme'
    },
    en: {
        menu: 'Menu',
        apk_notice: 'This application is under development, the first rule is not to leave the panel or the browser while on a call.',
        developer: 'Developed by IT Nelson Zua',
        contact: 'CONTACT: 935142914',
        gps: 'GPS: Soyo-Zaire- Angola',
        chat: 'Chat',
        set_name: 'Set Your Name',
        enter_name: 'Enter name...',
        save: 'Save',
        recipient: 'Recipient (optional)...',
        type_message: 'Type message...',
        send: 'Send',
        select: 'Select',
        delete_selected: 'Delete Selected',
        cancel: 'Cancel',
        close: 'Close',
        name: 'Name',
        id: 'ID',
        share_id: 'Share ID',
        change_name: 'Change Name',
        user_exists: 'This user already exists',
        anonymous: 'Anonymous'
    }
};

export const LanguageContext = createContext<{
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: keyof typeof translations['pt']) => string;
}>({
    language: 'pt',
    setLanguage: () => {},
    t: (key) => translations['pt'][key]
});

export const useLanguage = () => React.useContext(LanguageContext);

export function LanguageContextProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'pt');

    const t = (key: keyof typeof translations['pt']) => translations[language][key] || translations['pt'][key];

    useEffect(() => {
        localStorage.setItem('language', language);
    }, [language]);

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}
