export const DesktopSessionService = {
    getCurrentSession: () => {
        try {
            const sessionData = localStorage.getItem('zion_desktop_session');
            return sessionData ? JSON.parse(sessionData) : null;
        } catch (e) {
            return null;
        }
    },
    setCurrentSession: (user) => {
        if (user) {
            localStorage.setItem('zion_desktop_session', JSON.stringify(user));
        } else {
            localStorage.removeItem('zion_desktop_session');
        }
    },
    clearSession: () => {
        localStorage.removeItem('zion_desktop_session');
    },
    isOnline: () => {
        return typeof navigator !== 'undefined' && navigator.onLine;
    }
};
