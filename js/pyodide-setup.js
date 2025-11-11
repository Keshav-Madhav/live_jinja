import { state } from './state.js';
import { elements } from './dom.js';
import { loadFromUrlParam } from './url-config.js';

/**
 * Pyodide initialization and setup
 */

export async function setupPyodide(updateCallback) {
    try {
        elements.loader.style.display = 'block';
        elements.loadingOverlay.style.display = 'block';
        
        state.pyodide = await loadPyodide();
        await installJinja2Version(state.currentJinjaVersion);
        
        state.isInitialized = true;
        elements.loader.style.display = 'none';
        elements.loadingOverlay.style.display = 'none';
        
        // Check for shared configuration in URL
        loadFromUrlParam();
        
        // Initial render after setup
        updateCallback();
    } catch (error) {
        elements.loader.textContent = `Failed to load Python environment: ${error.message}`;
        elements.loader.style.color = '#d32f2f';
    }
}

export async function installJinja2Version(version) {
    try {
        // Show loading message
        elements.loader.textContent = `Loading Jinja2 ${version === 'latest' ? 'latest' : 'v' + version}...`;
        
        // Install the specific version
        if (version === 'latest') {
            await state.pyodide.loadPackage("jinja2");
        } else {
            // Load micropip first if not already loaded
            await state.pyodide.loadPackage("micropip");
            
            // Uninstall existing jinja2 if it's already loaded (for version switching)
            if (state.isInitialized) {
                try {
                    await state.pyodide.runPythonAsync(`
                        import micropip
                        await micropip.uninstall('jinja2')
                    `);
                    console.log('Uninstalled previous Jinja2 version');
                } catch (e) {
                    // If uninstall fails, it's okay - might not be installed yet
                    console.log('No previous Jinja2 to uninstall');
                }
            }
            
            // Install the specific version
            await state.pyodide.runPythonAsync(`
                import micropip
                await micropip.install('jinja2==${version}')
            `);
        }
        
        state.currentJinjaVersion = version;
        
        // Verify installation and show version
        const installedVersion = await state.pyodide.runPythonAsync(`
            import jinja2
            jinja2.__version__
        `);
        
        console.log(`Jinja2 version ${installedVersion} installed successfully`);
        
    } catch (error) {
        console.error('Failed to install Jinja2:', error);
        throw error;
    }
}
