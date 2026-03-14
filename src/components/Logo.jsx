import React from 'react';

/**
 * Zion Stage Logo Component
 * Automatically switches between black and white versions based on background.
 * @param {Object} props
 * @param {string} props.height - Height of the logo (default '32px')
 * @param {boolean} props.isDarkBackground - If true, uses white logo (zion-blanco). If false, uses black logo (zion-negro).
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.style - Additional inline styles
 */
const Logo = ({ height = '32px', isDarkBackground = true, className = '', style = {} }) => {
    // zionnegro (black) for white backgrounds
    // zionblanco (white) for black backgrounds
    const src = isDarkBackground ? '/logo2blanco.png' : '/logo2.png';
    
    return (
        <img 
            src={src} 
            alt="Zion Stage" 
            style={{ 
                height, 
                width: 'auto', 
                objectFit: 'contain',
                ...style 
            }} 
            className={className}
        />
    );
};

export default Logo;
