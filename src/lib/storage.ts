export const getCookie = (name: string): string => {
    if (typeof document === 'undefined') return '';
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop()?.split(';').shift() || '');
    return '';
};

export const safeStringify = (obj: any): string => {
  try {
    return JSON.stringify(obj);
  } catch (e) {
    console.error('safeStringify failed:', e instanceof Error ? e.message : 'Unknown error');
    return '{}';
  }
};

export const setCookie = (name: string, value: string, days = 365) => {
    if (typeof document === 'undefined') return;
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = `; expires=${date.toUTCString()}`;
    try {
        const isSecure = window.location.protocol === 'https:';
        // When running in an iframe over HTTPS (typical in AI Studio),
        // we must specify SameSite=None and Secure, otherwise browsers discard the cookie!
        const secureFlag = isSecure ? '; SameSite=None; Secure' : '; SameSite=Lax';
        document.cookie = `${name}=${encodeURIComponent(value)}${expires}; path=/${secureFlag}`;
    } catch (e) {
        console.warn('Failed to set cookie', e instanceof Error ? e.message : String(e));
    }
};

export const getPersistentItem = (key: string): string => {
    if (key === 'chatUsername') {
        try {
            return sessionStorage.getItem(key) || '';
        } catch (e) {
            console.warn('sessionStorage not accessible', e instanceof Error ? e.message : String(e));
            return '';
        }
    }
    try {
        const local = localStorage.getItem(key);
        if (local) return local;
    } catch (e) {
        console.warn('localStorage not accessible', e instanceof Error ? e.message : String(e));
    }
    return getCookie(key);
};

export const setPersistentItem = (key: string, value: string) => {
    if (key === 'chatUsername') {
        try {
            sessionStorage.setItem(key, value);
        } catch (e) {
            console.warn('sessionStorage not accessible', e instanceof Error ? e.message : String(e));
        }
        return;
    }
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        console.warn('localStorage not accessible', e instanceof Error ? e.message : String(e));
    }
    setCookie(key, value);
};

export const getOrCreateUserId = (): string => {
    let id = getPersistentItem('chatUserId');
    if (!id) {
        id = 'usr_' + Math.random().toString(36).substring(2, 11) + '_' + Math.random().toString(36).substring(2, 11);
        setPersistentItem('chatUserId', id);
    }
    return id;
};
