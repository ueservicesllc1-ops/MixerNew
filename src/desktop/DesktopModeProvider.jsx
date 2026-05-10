import React, { createContext, useContext, useState, useEffect } from 'react';
import { LicenseManager } from './LicenseManager';

const DesktopModeContext = createContext(null);

export const useDesktopMode = () => useContext(DesktopModeContext);

export const DesktopModeProvider = ({ children }) => {
    const isDesktop = typeof window !== 'undefined' && window.zionNative?.isDesktop === true;
    
    const [isDemo, setIsDemo] = useState(true);
    const [limits, setLimits] = useState({ maxSongs: 3, maxSetlists: 1 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isDesktop) {
            console.log("🖥️ Desktop Mode Activated. Firebase Auth bypassed.");
            LicenseManager.isDemo().then(demo => {
                setIsDemo(demo);
                LicenseManager.getLimits().then(l => setLimits(l));
                setLoading(false);
            });
        } else {
            setLoading(false);
        }
    }, [isDesktop]);

    return (
        <DesktopModeContext.Provider value={{ isDesktop, isDemo, limits, loading }}>
            {children}
        </DesktopModeContext.Provider>
    );
};
