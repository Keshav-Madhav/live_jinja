import { truncateText, formatDate } from './utils.js';

/**
 * Configuration saving and loading
 */

/**
 * Saves the current configuration to local storage
 */
export function saveConfiguration(configName, jinjaEditor, getCurrentVariablesCallback, isFormMode, toggleStates, overrideName = null) {
    const finalName = overrideName || configName;
    
    if (!finalName) {
        throw new Error('Configuration name is required');
    }
    
    let savedConfigs = [];
    try {
        const stored = localStorage.getItem('jinjaConfigurations');
        if (stored) {
            savedConfigs = JSON.parse(stored);
        }
    } catch (e) {
        console.error('Error loading saved configurations:', e);
        savedConfigs = [];
    }
    
    const template = jinjaEditor.getValue();
    const variables = getCurrentVariablesCallback();
    
    const config = {
        name: finalName,
        template: template,
        variables: variables,
        timestamp: new Date().toISOString(),
        isFormMode: isFormMode,
        switchStates: toggleStates
    };
    
    const existingIndex = savedConfigs.findIndex(c => c.name === finalName);
    if (existingIndex !== -1) {
        savedConfigs[existingIndex] = config;
    } else {
        savedConfigs.push(config);
    }
    
    localStorage.setItem('jinjaConfigurations', JSON.stringify(savedConfigs));
    
    return config;
}

/**
 * Loads a saved configuration
 */
export function loadConfiguration(config, jinjaEditor, varsEditor, isFormMode, toggleModeBtn, createVariableFormCallback, currentVariableValues) {
    jinjaEditor.setValue(config.template || '');
    
    if (config.isFormMode) {
        if (!isFormMode) {
            toggleModeBtn.click();
        }
        Object.assign(currentVariableValues, config.variables || {});
        createVariableFormCallback(config.variables || {});
    } else {
        if (isFormMode) {
            toggleModeBtn.click();
        }
        varsEditor.setValue(JSON.stringify(config.variables || {}, null, 2));
    }
    
    return config.switchStates || {};
}

/**
 * Deletes a configuration by index
 */
export function deleteConfiguration(index) {
    try {
        const stored = localStorage.getItem('jinjaConfigurations');
        let configs = stored ? JSON.parse(stored) : [];
        
        if (index >= 0 && index < configs.length) {
            configs.splice(index, 1);
            localStorage.setItem('jinjaConfigurations', JSON.stringify(configs));
            return true;
        }
        return false;
    } catch (e) {
        console.error('Error deleting configuration:', e);
        return false;
    }
}

/**
 * Renames a configuration
 */
export function renameConfiguration(index, newName) {
    try {
        const stored = localStorage.getItem('jinjaConfigurations');
        let configs = stored ? JSON.parse(stored) : [];
        
        if (index >= 0 && index < configs.length) {
            configs[index].name = newName;
            localStorage.setItem('jinjaConfigurations', JSON.stringify(configs));
            return true;
        }
        return false;
    } catch (e) {
        console.error('Error renaming configuration:', e);
        return false;
    }
}

/**
 * Gets all saved configurations
 */
export function getSavedConfigurations() {
    try {
        const stored = localStorage.getItem('jinjaConfigurations');
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error('Error loading saved configurations:', e);
        return [];
    }
}

/**
 * Creates a configuration card element
 */
export function createConfigCard(config, index, callbacks) {
    const card = document.createElement('div');
    card.className = 'config-card';
    
    const header = document.createElement('div');
    header.className = 'config-card-header';
    
    const nameContainer = document.createElement('div');
    nameContainer.className = 'config-card-name-container';
    
    const name = document.createElement('h3');
    name.className = 'config-card-name';
    name.textContent = config.name;
    
    const renameIcon = document.createElement('button');
    renameIcon.className = 'config-rename-icon';
    renameIcon.innerHTML = '✏️';
    renameIcon.setAttribute('aria-label', 'Rename configuration');
    renameIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onRename(index, config.name);
    });
    
    nameContainer.appendChild(name);
    nameContainer.appendChild(renameIcon);
    
    const dateVersionContainer = document.createElement('div');
    dateVersionContainer.style.display = 'flex';
    dateVersionContainer.style.flexDirection = 'column';
    dateVersionContainer.style.alignItems = 'flex-end';
    dateVersionContainer.style.gap = '4px';
    
    const date = document.createElement('span');
    date.className = 'config-card-date';
    date.textContent = formatDate(config.timestamp);
    dateVersionContainer.appendChild(date);
    
    if (config.switchStates && config.switchStates.jinjaVersion) {
        const versionSpan = document.createElement('span');
        versionSpan.className = 'config-card-version';
        const versionText = config.switchStates.jinjaVersion === 'latest' ? 'Latest' : `v${config.switchStates.jinjaVersion}`;
        versionSpan.textContent = versionText;
        dateVersionContainer.appendChild(versionSpan);
    }
    
    header.appendChild(nameContainer);
    header.appendChild(dateVersionContainer);
    card.appendChild(header);
    
    // Template section
    const templateSection = document.createElement('div');
    templateSection.className = 'config-card-section';
    
    const templateLabel = document.createElement('div');
    templateLabel.className = 'config-card-label';
    templateLabel.textContent = 'Template';
    
    const templateContent = document.createElement('div');
    templateContent.className = 'config-card-content';
    templateContent.textContent = truncateText(config.template, 80);
    
    templateSection.appendChild(templateLabel);
    templateSection.appendChild(templateContent);
    card.appendChild(templateSection);
    
    // Variables section
    const varsSection = document.createElement('div');
    varsSection.className = 'config-card-section';
    
    const varsLabel = document.createElement('div');
    varsLabel.className = 'config-card-label';
    varsLabel.textContent = 'Variables';
    
    const varsContent = document.createElement('div');
    varsContent.className = 'config-card-content';
    const varsString = JSON.stringify(config.variables);
    varsContent.textContent = truncateText(varsString, 80);
    
    varsSection.appendChild(varsLabel);
    varsSection.appendChild(varsContent);
    card.appendChild(varsSection);
    
    // Switch states badges
    if (config.switchStates) {
        const activeSwitches = [];
        if (config.switchStates.autoRerender) activeSwitches.push('Auto-rerender');
        if (config.switchStates.markdown) activeSwitches.push('Markdown');
        if (config.switchStates.mermaid) activeSwitches.push('Mermaid');
        if (config.switchStates.showWhitespace) activeSwitches.push('Whitespace');
        if (config.switchStates.removeExtraWhitespace) activeSwitches.push('Remove Extra');
        if (config.switchStates.textWrap) activeSwitches.push('Text Wrap');
        
        if (activeSwitches.length > 0) {
            const switchesContainer = document.createElement('div');
            switchesContainer.className = 'config-card-switches';
            
            activeSwitches.forEach(switchName => {
                const badge = document.createElement('span');
                badge.className = 'config-switch-badge';
                badge.textContent = switchName;
                switchesContainer.appendChild(badge);
            });
            
            card.appendChild(switchesContainer);
        }
    }
    
    // Actions section
    const actions = document.createElement('div');
    actions.className = 'config-card-actions';
    
    const loadBtn = document.createElement('button');
    loadBtn.className = 'config-action-btn load-btn';
    loadBtn.textContent = 'Load';
    loadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onLoad(config);
    });
    
    const shareBtn = document.createElement('button');
    shareBtn.className = 'config-action-btn share-btn';
    shareBtn.textContent = 'Share';
    shareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onShare(config, shareBtn);
    });
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'config-action-btn delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onDelete(index);
    });
    
    actions.appendChild(loadBtn);
    actions.appendChild(shareBtn);
    actions.appendChild(deleteBtn);
    card.appendChild(actions);
    
    return card;
}
