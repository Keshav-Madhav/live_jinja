/**
 * Live Jinja - Main Application
 * Modular entry point that initializes all components
 */

import { state } from './state.js';
import { elements } from './dom.js';
import { jinjaEditor, varsEditor } from './editors.js';
import { setupPyodide, installJinja2Version } from './pyodide-setup.js';
import { update, getCurrentVariables } from './renderer.js';
import { extractVariablesFromTemplate } from './variable-extractor.js';
import { createVariableForm, syncFormToJson } from './form-generator.js';
import { showButtonFeedback, showToggleFeedback } from './feedback.js';
import { initializeMermaid, renderMarkdown, renderPureMermaid } from './markdown-renderer.js';
import { initializeResize } from './resize-handler.js';
import { 
    saveConfiguration, 
    loadConfiguration, 
    deleteConfiguration, 
    renameConfiguration,
    getSavedConfigurations,
    createConfigCard 
} from './config-manager.js';
import { shareConfiguration, loadFromUrlParam } from './url-config.js';
import { debounce } from './utils.js';
import { generateUniqueName } from './utils.js';

/**
 * Initialize Mermaid
 */
initializeMermaid();

/**
 * Event listener setup
 */
function setupEventListeners() {
    // Remove existing listeners
    if (state.debouncedUpdateFromJinja) {
        jinjaEditor.off('change', state.debouncedUpdateFromJinja);
    }
    if (state.debouncedUpdateFromVars) {
        varsEditor.off('change', state.debouncedUpdateFromVars);
    }
    
    if (elements.autoRerenderToggle.checked) {
        state.debouncedUpdateFromJinja = debounce(update, 300);
        state.debouncedUpdateFromVars = debounce(update, 300);
        
        jinjaEditor.on('change', state.debouncedUpdateFromJinja);
        varsEditor.on('change', state.debouncedUpdateFromVars);
    } else {
        state.debouncedUpdateFromJinja = null;
        state.debouncedUpdateFromVars = null;
    }
}

/**
 * Track user editing state
 */
jinjaEditor.on('change', (cm, change) => {
    state.isUserEditing = true;
    
    if (state.editingTimeout) {
        clearTimeout(state.editingTimeout);
    }
    
    state.editingTimeout = setTimeout(() => {
        state.isUserEditing = false;
    }, 500);
});

/**
 * Control event handlers
 */

// Extract variables button
elements.extractVariablesBtn.addEventListener('click', function() {
    const template = jinjaEditor.getValue();
    const newVariableStructures = extractVariablesFromTemplate(template);
    
    const currentValues = getCurrentVariables();
    
    function mergeStructures(newStruct, existingValues) {
        if (Array.isArray(newStruct)) {
            return existingValues && Array.isArray(existingValues) ? existingValues : newStruct;
        } else if (typeof newStruct === 'object' && newStruct !== null) {
            const merged = {};
            Object.keys(newStruct).forEach(key => {
                if (existingValues && typeof existingValues === 'object' && key in existingValues) {
                    merged[key] = mergeStructures(newStruct[key], existingValues[key]);
                } else {
                    merged[key] = newStruct[key];
                }
            });
            return merged;
        } else {
            return existingValues !== undefined ? existingValues : newStruct;
        }
    }
    
    const mergedVariables = {};
    Object.keys(newVariableStructures).forEach(varName => {
        mergedVariables[varName] = mergeStructures(
            newVariableStructures[varName], 
            currentValues[varName]
        );
    });
    
    state.extractedVariables = new Set(Object.keys(newVariableStructures));
    state.currentVariableValues = mergedVariables;
    
    if (state.isFormMode) {
        createVariableForm(newVariableStructures, getCurrentVariables, 
            () => syncFormToJson(state.isFormMode, getCurrentVariables, varsEditor, elements.syncFormBtn),
            elements.autoRerenderToggle, update);
    }
    
    varsEditor.setValue(JSON.stringify(mergedVariables, null, 2));
    update();

    const variableCount = Object.keys(newVariableStructures).length;
    const message = variableCount > 0 ? `Found ${variableCount} variable${variableCount !== 1 ? 's' : ''}!` : 'No variables found!';
    showButtonFeedback(this, message, 2000);
});

// Sync form to JSON button
elements.syncFormBtn.addEventListener('click', function() {
    if (state.isFormMode) {
        syncFormToJson(state.isFormMode, getCurrentVariables, varsEditor, elements.syncFormBtn);
        showButtonFeedback(this, 'Synced to JSON!', 1500);
    }
});

// Mode toggle button
elements.toggleModeBtn.addEventListener('click', function() {
    const wasFormMode = state.isFormMode;
    state.isFormMode = !state.isFormMode;
    
    if (state.isFormMode) {
        varsEditor.getWrapperElement().style.display = 'none';
        elements.variablesForm.style.display = 'block';
        elements.toggleModeBtn.textContent = 'Switch to JSON Mode';
        elements.variablesHeader.textContent = 'Variables (Form)';
        elements.syncFormBtn.style.display = 'inline-block';
        
        try {
            const currentVars = JSON.parse(varsEditor.getValue() || '{}');
            state.currentVariableValues = { ...state.currentVariableValues, ...currentVars };
            
            const variableStructures = {};
            Object.keys(currentVars).forEach(key => {
                variableStructures[key] = currentVars[key];
            });
            
            state.extractedVariables = new Set(Object.keys(currentVars));
            
            createVariableForm(variableStructures, getCurrentVariables,
                () => syncFormToJson(state.isFormMode, getCurrentVariables, varsEditor, elements.syncFormBtn),
                elements.autoRerenderToggle, update);
        } catch (e) {
            createVariableForm({}, getCurrentVariables,
                () => syncFormToJson(state.isFormMode, getCurrentVariables, varsEditor, elements.syncFormBtn),
                elements.autoRerenderToggle, update);
        }
    } else {
        varsEditor.getWrapperElement().style.display = 'block';
        elements.variablesForm.style.display = 'none';
        elements.toggleModeBtn.textContent = 'Switch to Form Mode';
        elements.variablesHeader.textContent = 'Variables (JSON)';
        elements.syncFormBtn.style.display = 'none';
        
        const currentVars = getCurrentVariables();
        varsEditor.setValue(JSON.stringify(currentVars, null, 2));
    }

    const mode = state.isFormMode ? 'Form' : 'JSON';
    showButtonFeedback(this, `Switched to ${mode}!`, 1500);
});

// Text wrap toggle
elements.textWrapToggle.addEventListener('change', function() {
    const wrapMode = this.checked;
    jinjaEditor.setOption('lineWrapping', wrapMode);
    varsEditor.setOption('lineWrapping', wrapMode);
    
    const message = wrapMode ? 'Text wrap enabled!' : 'Text wrap disabled!';
    showToggleFeedback(this.parentElement, message);
});

// Whitespace toggle
elements.showWhitespaceToggle.addEventListener('change', function() {
    update();
    const message = this.checked ? 'Whitespace visible' : 'Whitespace hidden';
    showToggleFeedback(this.parentElement, message);
});

// Remove extra whitespace toggle
elements.removeExtraWhitespaceToggle.addEventListener('change', function() {
    update();
    const message = this.checked ? 'Extra whitespace removed' : 'Extra whitespace kept';
    showToggleFeedback(this.parentElement, message);
});

// Markdown toggle
elements.markdownToggle.addEventListener('change', async function() {
    if (this.checked) {
        if (state.isMermaidMode) {
            elements.mermaidToggle.checked = false;
            state.isMermaidMode = false;
        }
        
        state.isMarkdownMode = true;
        elements.outputElement.style.display = 'none';
        elements.markdownOutputElement.style.display = 'block';
        
        if (state.lastRenderedOutput) {
            await renderMarkdown(state.lastRenderedOutput);
        }
        
        elements.showWhitespaceToggle.disabled = true;
        elements.showWhitespaceToggle.parentElement.style.opacity = '0.5';
        
        showToggleFeedback(this.parentElement, 'Markdown mode enabled!');
    } else {
        state.isMarkdownMode = false;
        elements.outputElement.style.display = 'block';
        elements.markdownOutputElement.style.display = 'none';
        
        if (state.lastRenderedOutput) {
            if (elements.showWhitespaceToggle.checked) {
                const { renderWhitespace } = await import('./whitespace.js');
                elements.outputElement.innerHTML = renderWhitespace(state.lastRenderedOutput);
            } else {
                elements.outputElement.textContent = state.lastRenderedOutput;
            }
            elements.outputElement.className = state.lastRenderedOutput.includes('Error:') ? 'error' : '';
        }
        
        elements.showWhitespaceToggle.disabled = false;
        elements.showWhitespaceToggle.parentElement.style.opacity = '1';
        
        showToggleFeedback(this.parentElement, 'Plain text mode enabled!');
    }
});

// Mermaid toggle
elements.mermaidToggle.addEventListener('change', async function() {
    if (this.checked) {
        if (state.isMarkdownMode) {
            elements.markdownToggle.checked = false;
            state.isMarkdownMode = false;
        }
        
        state.isMermaidMode = true;
        elements.outputElement.style.display = 'none';
        elements.markdownOutputElement.style.display = 'block';
        
        if (state.lastRenderedOutput) {
            await renderPureMermaid(state.lastRenderedOutput);
        }
        
        elements.showWhitespaceToggle.disabled = true;
        elements.showWhitespaceToggle.parentElement.style.opacity = '0.5';
        
        showToggleFeedback(this.parentElement, 'Mermaid mode enabled!');
    } else {
        state.isMermaidMode = false;
        elements.outputElement.style.display = 'block';
        elements.markdownOutputElement.style.display = 'none';
        
        if (state.lastRenderedOutput) {
            if (elements.showWhitespaceToggle.checked) {
                const { renderWhitespace } = await import('./whitespace.js');
                elements.outputElement.innerHTML = renderWhitespace(state.lastRenderedOutput);
            } else {
                elements.outputElement.textContent = state.lastRenderedOutput;
            }
            elements.outputElement.className = state.lastRenderedOutput.includes('Error:') ? 'error' : '';
        }
        
        elements.showWhitespaceToggle.disabled = false;
        elements.showWhitespaceToggle.parentElement.style.opacity = '1';
        
        showToggleFeedback(this.parentElement, 'Plain text mode enabled!');
    }
});

// Auto rerender toggle
elements.autoRerenderToggle.addEventListener('change', function() {
    elements.manualRerenderBtn.disabled = this.checked;
    setupEventListeners();
    
    const message = this.checked ? 'Auto rerender enabled!' : 'Auto rerender disabled!';
    showToggleFeedback(this.parentElement, message);
});

// Manual rerender button
elements.manualRerenderBtn.addEventListener('click', function() {
    update();
    showButtonFeedback(this, 'Rerendered!', 1000);
});

// Copy template button
elements.copyTemplateBtn.addEventListener('click', async function() {
    try {
        await navigator.clipboard.writeText(jinjaEditor.getValue());
        showButtonFeedback(this, 'Copied!', 1500);
    } catch (err) {
        const textArea = document.createElement('textarea');
        textArea.value = jinjaEditor.getValue();
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showButtonFeedback(this, 'Copied!', 1500);
    }
});

// Copy output button
elements.copyOutputBtn.addEventListener('click', async function() {
    try {
        await navigator.clipboard.writeText(elements.outputElement.textContent);
        showButtonFeedback(this, 'Copied!', 1500);
    } catch (err) {
        const textArea = document.createElement('textarea');
        textArea.value = elements.outputElement.textContent;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showButtonFeedback(this, 'Copied!', 1500);
    }
});

// Theme toggle
elements.themeToggle.addEventListener('change', function() {
    const isLightMode = this.checked;
    
    if (isLightMode) {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light');
        jinjaEditor.setOption('theme', 'default');
        varsEditor.setOption('theme', 'default');
        
        mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
            flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis', wrap: true },
            themeVariables: { fontSize: '14px' }
        });
    } else {
        document.body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
        jinjaEditor.setOption('theme', 'material-darker');
        varsEditor.setOption('theme', 'material-darker');
        
        mermaid.initialize({
            startOnLoad: false,
            theme: 'dark',
            securityLevel: 'loose',
            flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis', wrap: true },
            themeVariables: { fontSize: '14px' }
        });
    }
    
    if (state.isMarkdownMode && state.lastRenderedOutput) {
        renderMarkdown(state.lastRenderedOutput);
    } else if (state.isMermaidMode && state.lastRenderedOutput) {
        renderPureMermaid(state.lastRenderedOutput);
    }
    
    setTimeout(() => {
        jinjaEditor.refresh();
        varsEditor.refresh();
    }, 10);
});

// Jinja version selector
elements.jinjaVersionSelect.addEventListener('change', async function() {
    const selectedVersion = this.value;
    
    if (!state.isInitialized || selectedVersion === state.currentJinjaVersion) {
        return;
    }
    
    try {
        elements.loader.textContent = `Switching to Jinja2 ${selectedVersion === 'latest' ? 'latest' : 'v' + selectedVersion}...`;
        elements.loader.style.display = 'block';
        elements.loadingOverlay.style.display = 'block';
        this.disabled = true;
        
        await installJinja2Version(selectedVersion);
        
        this.value = selectedVersion;
        elements.loader.style.display = 'none';
        elements.loadingOverlay.style.display = 'none';
        this.disabled = false;
        
        await update();
    } catch (error) {
        elements.loader.textContent = `Failed to switch Jinja2 version: ${error.message}`;
        elements.loader.style.color = '#d32f2f';
        this.disabled = false;
        console.error('Version switch error:', error);
    }
});

// Custom dropdown functionality
elements.customSelectTrigger?.addEventListener('click', function(e) {
    e.stopPropagation();
    elements.customJinjaSelect.classList.toggle('open');
});

document.addEventListener('click', function(e) {
    if (!elements.customJinjaSelect.contains(e.target)) {
        elements.customJinjaSelect.classList.remove('open');
    }
});

elements.versionOptions?.querySelectorAll('.custom-option').forEach(option => {
    option.addEventListener('click', function() {
        const value = this.getAttribute('data-value');
        const text = this.textContent;
        
        elements.versionOptions.querySelectorAll('.custom-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        this.classList.add('selected');
        
        elements.selectedVersionText.textContent = text;
        elements.jinjaVersionSelect.value = value;
        elements.jinjaVersionSelect.dispatchEvent(new Event('change'));
        
        elements.customJinjaSelect.classList.remove('open');
    });
});

elements.versionOptions?.querySelector('.custom-option[data-value="latest"]')?.classList.add('selected');

/**
 * Configuration management event handlers
 */

// Save configuration button
elements.saveConfigBtn.addEventListener('click', function() {
    elements.saveModalOverlay.classList.add('active');
    elements.configNameInput.value = '';
    elements.configNameInput.focus();
});

// Save modal handlers
elements.modalCloseBtn.addEventListener('click', () => {
    elements.saveModalOverlay.classList.remove('active');
});

elements.modalCancelBtn.addEventListener('click', () => {
    elements.saveModalOverlay.classList.remove('active');
});

elements.modalSaveBtn.addEventListener('click', () => {
    const configName = elements.configNameInput.value.trim();
    
    if (!configName) {
        elements.configNameInput.style.borderColor = '#ef4444';
        elements.configNameInput.placeholder = 'Please enter a name';
        setTimeout(() => {
            elements.configNameInput.style.borderColor = '';
            elements.configNameInput.placeholder = 'Enter a name for this configuration';
        }, 2000);
        return;
    }
    
    const configs = getSavedConfigurations();
    const existingIndex = configs.findIndex(c => c.name === configName);
    
    if (existingIndex !== -1) {
        // Show conflict modal
        elements.saveModalOverlay.classList.remove('active');
        openConflictModal(configName, false);
        return;
    }
    
    try {
        const toggleStates = {
            textWrap: elements.textWrapToggle.checked,
            autoRerender: elements.autoRerenderToggle.checked,
            showWhitespace: elements.showWhitespaceToggle.checked,
            removeExtraWhitespace: elements.removeExtraWhitespaceToggle.checked,
            markdown: elements.markdownToggle.checked,
            mermaid: elements.mermaidToggle.checked,
            theme: elements.themeToggle.checked,
            jinjaVersion: elements.jinjaVersionSelect.value
        };
        
        saveConfiguration(configName, jinjaEditor, getCurrentVariables, state.isFormMode, toggleStates);
        
        elements.saveModalOverlay.classList.remove('active');
        showButtonFeedback(elements.saveConfigBtn, 'Saved!', 2000);
    } catch (e) {
        console.error('Error saving configuration:', e);
        alert('Error saving configuration.');
    }
});

elements.configNameInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        elements.modalSaveBtn.click();
    }
});

elements.saveModalOverlay.addEventListener('click', function(e) {
    if (e.target === elements.saveModalOverlay) {
        elements.saveModalOverlay.classList.remove('active');
    }
});

// Share current configuration
elements.shareCurrentBtn.addEventListener('click', async function() {
    try {
        const toggleStates = {
            textWrap: elements.textWrapToggle.checked,
            autoRerender: elements.autoRerenderToggle.checked,
            showWhitespace: elements.showWhitespaceToggle.checked,
            removeExtraWhitespace: elements.removeExtraWhitespaceToggle.checked,
            markdown: elements.markdownToggle.checked,
            mermaid: elements.mermaidToggle.checked,
            theme: elements.themeToggle.checked,
            jinjaVersion: elements.jinjaVersionSelect.value
        };
        
        const shareConfig = {
            name: "Shared Configuration",
            template: jinjaEditor.getValue(),
            variables: getCurrentVariables(),
            isFormMode: state.isFormMode,
            switchStates: toggleStates
        };
        
        await shareConfiguration(shareConfig, this);
        showButtonFeedback(this, 'URL Copied!', 2000);
    } catch (err) {
        console.error('Error sharing:', err);
        showButtonFeedback(this, 'Error!', 2000);
    }
});

// Drawer functionality
elements.burgerMenuBtn.addEventListener('click', function() {
    if (elements.savedConfigsDrawer.classList.contains('active')) {
        closeDrawer();
    } else {
        openDrawer();
    }
});

elements.drawerCloseBtn.addEventListener('click', () => closeDrawer());
elements.drawerOverlay.addEventListener('click', () => closeDrawer());

function openDrawer() {
    elements.burgerMenuBtn.classList.add('active');
    elements.drawerOverlay.classList.add('active');
    elements.savedConfigsDrawer.classList.add('active');
    loadSavedConfigurationsInDrawer();
}

function closeDrawer() {
    elements.burgerMenuBtn.classList.remove('active');
    elements.drawerOverlay.classList.remove('active');
    elements.savedConfigsDrawer.classList.remove('active');
}

function loadSavedConfigurationsInDrawer() {
    const configs = getSavedConfigurations();
    
    elements.drawerContent.innerHTML = '';
    
    if (configs.length === 0) {
        elements.drawerEmptyMessage.style.display = 'block';
        elements.drawerContent.appendChild(elements.drawerEmptyMessage);
    } else {
        elements.drawerEmptyMessage.style.display = 'none';
        
        const reversedConfigs = [...configs].reverse();
        reversedConfigs.forEach((config, index) => {
            const actualIndex = configs.length - 1 - index;
            const card = createConfigCard(config, actualIndex, {
                onRename: (idx, name) => openRenameModal(idx, name),
                onLoad: (cfg) => {
                    const switchStates = loadConfiguration(cfg, jinjaEditor, varsEditor, state.isFormMode, 
                        elements.toggleModeBtn, 
                        (vars) => createVariableForm(vars, getCurrentVariables,
                            () => syncFormToJson(state.isFormMode, getCurrentVariables, varsEditor, elements.syncFormBtn),
                            elements.autoRerenderToggle, update),
                        state.currentVariableValues);
                    
                    // Apply switch states
                    if (switchStates.textWrap !== undefined) elements.textWrapToggle.checked = switchStates.textWrap;
                    if (switchStates.autoRerender !== undefined) {
                        elements.autoRerenderToggle.checked = switchStates.autoRerender;
                        elements.manualRerenderBtn.disabled = switchStates.autoRerender;
                        setupEventListeners();
                    }
                    
                    update();
                    closeDrawer();
                },
                onShare: shareConfiguration,
                onDelete: (idx) => {
                    if (deleteConfiguration(idx)) {
                        loadSavedConfigurationsInDrawer();
                    }
                }
            });
            elements.drawerContent.appendChild(card);
        });
    }
}

// Rename modal
function openRenameModal(index, currentName) {
    state.currentRenameIndex = index;
    elements.renameConfigNameInput.value = currentName;
    elements.renameModalOverlay.classList.add('active');
    elements.renameConfigNameInput.focus();
    elements.renameConfigNameInput.select();
}

function closeRenameModal() {
    state.currentRenameIndex = null;
    elements.renameModalOverlay.classList.remove('active');
    elements.renameConfigNameInput.value = '';
}

elements.renameModalCloseBtn.addEventListener('click', closeRenameModal);
elements.renameModalCancelBtn.addEventListener('click', closeRenameModal);

elements.renameModalSaveBtn.addEventListener('click', function() {
    const newName = elements.renameConfigNameInput.value.trim();
    
    if (!newName) {
        elements.renameConfigNameInput.style.borderColor = '#ef4444';
        return;
    }
    
    const configs = getSavedConfigurations();
    const conflictIndex = configs.findIndex((c, idx) => c.name === newName && idx !== state.currentRenameIndex);
    
    if (conflictIndex !== -1) {
        closeRenameModal();
        openConflictModal(newName, true);
        return;
    }
    
    if (renameConfiguration(state.currentRenameIndex, newName)) {
        loadSavedConfigurationsInDrawer();
        closeRenameModal();
    }
});

elements.renameConfigNameInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        elements.renameModalSaveBtn.click();
    }
});

elements.renameModalOverlay.addEventListener('click', function(e) {
    if (e.target === elements.renameModalOverlay) {
        closeRenameModal();
    }
});

// Conflict modal
function openConflictModal(conflictName, isRename = false) {
    const configs = getSavedConfigurations();
    const existingNames = configs.map(c => c.name);
    const uniqueName = generateUniqueName(conflictName, existingNames);
    
    elements.conflictNameDisplay.textContent = conflictName;
    elements.conflictNewNameInput.value = uniqueName;
    elements.conflictButtonName.textContent = uniqueName;
    
    state.conflictContext = {
        originalName: conflictName,
        uniqueName: uniqueName,
        isRename: isRename,
        existingNames: existingNames
    };
    
    validateConflictInput();
    elements.conflictModalOverlay.classList.add('active');
    
    setTimeout(() => {
        elements.conflictNewNameInput.focus();
        elements.conflictNewNameInput.select();
    }, 100);
}

function closeConflictModal() {
    elements.conflictModalOverlay.classList.remove('active');
    elements.conflictNewNameInput.value = '';
    elements.conflictInputHint.textContent = '';
    elements.conflictInputHint.className = 'modal-input-hint';
    state.conflictContext = null;
}

function validateConflictInput() {
    if (!state.conflictContext) return;
    
    const newName = elements.conflictNewNameInput.value.trim();
    const { originalName, existingNames } = state.conflictContext;
    
    elements.conflictInputHint.className = 'modal-input-hint';
    elements.conflictInputHint.textContent = '';
    
    if (!newName) {
        elements.conflictSaveNewBtn.disabled = true;
        elements.conflictOverrideBtn.disabled = false;
        elements.conflictInputHint.className = 'modal-input-hint error';
        elements.conflictInputHint.textContent = 'Please enter a name';
        return;
    }
    
    if (newName === originalName) {
        elements.conflictSaveNewBtn.disabled = true;
        elements.conflictOverrideBtn.disabled = false;
        elements.conflictInputHint.className = 'modal-input-hint info';
        elements.conflictInputHint.textContent = 'This name already exists. Use "Override" to replace it.';
        return;
    }
    
    if (existingNames.includes(newName)) {
        elements.conflictSaveNewBtn.disabled = true;
        elements.conflictOverrideBtn.disabled = false;
        elements.conflictInputHint.className = 'modal-input-hint error';
        elements.conflictInputHint.textContent = 'This name also already exists. Choose a different name.';
        return;
    }
    
    elements.conflictSaveNewBtn.disabled = false;
    elements.conflictOverrideBtn.disabled = true;
    elements.conflictButtonName.textContent = newName;
    elements.conflictInputHint.className = 'modal-input-hint success';
    elements.conflictInputHint.textContent = '✓ This name is available';
}

elements.conflictModalCloseBtn.addEventListener('click', closeConflictModal);
elements.conflictNewNameInput.addEventListener('input', validateConflictInput);

elements.conflictNewNameInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !elements.conflictSaveNewBtn.disabled) {
        elements.conflictSaveNewBtn.click();
    }
});

elements.conflictOverrideBtn.addEventListener('click', function() {
    if (!state.conflictContext) return;
    
    if (state.conflictContext.isRename) {
        if (renameConfiguration(state.currentRenameIndex, state.conflictContext.originalName)) {
            loadSavedConfigurationsInDrawer();
            closeRenameModal();
            closeConflictModal();
        }
    } else {
        const toggleStates = {
            textWrap: elements.textWrapToggle.checked,
            autoRerender: elements.autoRerenderToggle.checked,
            showWhitespace: elements.showWhitespaceToggle.checked,
            removeExtraWhitespace: elements.removeExtraWhitespaceToggle.checked,
            markdown: elements.markdownToggle.checked,
            mermaid: elements.mermaidToggle.checked,
            theme: elements.themeToggle.checked,
            jinjaVersion: elements.jinjaVersionSelect.value
        };
        
        saveConfiguration(state.conflictContext.originalName, jinjaEditor, getCurrentVariables, 
            state.isFormMode, toggleStates, state.conflictContext.originalName);
        
        elements.saveModalOverlay.classList.remove('active');
        closeConflictModal();
        showButtonFeedback(elements.saveConfigBtn, 'Saved!', 2000);
    }
});

elements.conflictSaveNewBtn.addEventListener('click', function() {
    if (!state.conflictContext || this.disabled) return;
    
    const newName = elements.conflictNewNameInput.value.trim();
    
    if (state.conflictContext.isRename) {
        if (renameConfiguration(state.currentRenameIndex, newName)) {
            loadSavedConfigurationsInDrawer();
            closeRenameModal();
            closeConflictModal();
        }
    } else {
        const toggleStates = {
            textWrap: elements.textWrapToggle.checked,
            autoRerender: elements.autoRerenderToggle.checked,
            showWhitespace: elements.showWhitespaceToggle.checked,
            removeExtraWhitespace: elements.removeExtraWhitespaceToggle.checked,
            markdown: elements.markdownToggle.checked,
            mermaid: elements.mermaidToggle.checked,
            theme: elements.themeToggle.checked,
            jinjaVersion: elements.jinjaVersionSelect.value
        };
        
        saveConfiguration(newName, jinjaEditor, getCurrentVariables, state.isFormMode, toggleStates);
        
        elements.saveModalOverlay.classList.remove('active');
        closeConflictModal();
        showButtonFeedback(elements.saveConfigBtn, 'Saved!', 2000);
    }
});

elements.conflictModalOverlay.addEventListener('click', function(e) {
    if (e.target === elements.conflictModalOverlay) {
        closeConflictModal();
    }
});

// Escape key handler
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        if (elements.conflictModalOverlay.classList.contains('active')) {
            closeConflictModal();
        } else if (elements.saveModalOverlay.classList.contains('active')) {
            elements.saveModalOverlay.classList.remove('active');
        } else if (elements.renameModalOverlay.classList.contains('active')) {
            closeRenameModal();
        } else if (elements.savedConfigsDrawer.classList.contains('active')) {
            closeDrawer();
        }
    }
});

/**
 * Initialize application
 */

// Load saved theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') {
    document.body.classList.remove('dark-mode');
    elements.themeToggle.checked = true;
    jinjaEditor.setOption('theme', 'default');
    varsEditor.setOption('theme', 'default');
} else {
    document.body.classList.add('dark-mode');
    elements.themeToggle.checked = false;
    jinjaEditor.setOption('theme', 'material-darker');
    varsEditor.setOption('theme', 'material-darker');
}

// Initialize resize handlers
initializeResize();

// Setup event listeners
setupEventListeners();

// Start Pyodide and initial render
setupPyodide(update);
