/**
 * URL configuration sharing functions
 */

/**
 * Shares a configuration by creating a compressed URL
 */
export async function shareConfiguration(config, button) {
    try {
        const shareConfig = {
            name: config.name,
            template: config.template,
            variables: config.variables,
            isFormMode: config.isFormMode,
            switchStates: config.switchStates
        };
        
        const json = JSON.stringify(shareConfig);
        const compressed = LZString.compressToEncodedURIComponent(json);
        
        const baseUrl = window.location.origin + window.location.pathname;
        const shareUrl = `${baseUrl}?config=${compressed}`;
        
        await navigator.clipboard.writeText(shareUrl);
        
        if (button) {
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            button.style.background = getComputedStyle(document.documentElement).getPropertyValue('--success-color').trim();
            
            setTimeout(() => {
                button.textContent = originalText;
                button.style.background = '';
            }, 2000);
        }
        
        console.log('Share URL length:', shareUrl.length);
        return shareUrl;
    } catch (err) {
        console.error('Error sharing configuration:', err);
        
        if (button) {
            const originalText = button.textContent;
            button.textContent = 'Error!';
            button.style.background = '#ef4444';
            
            setTimeout(() => {
                button.textContent = originalText;
                button.style.background = '';
            }, 2000);
        }
        
        throw err;
    }
}

/**
 * Loads configuration from URL parameter
 */
export function loadFromUrlParam() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const configParam = urlParams.get('config');
        
        if (configParam) {
            const decompressed = LZString.decompressFromEncodedURIComponent(configParam);
            const config = JSON.parse(decompressed);
            
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
            
            console.log('Loaded shared configuration:', config.name);
            return config;
        }
        return null;
    } catch (e) {
        console.error('Error loading configuration from URL:', e);
        return null;
    }
}
