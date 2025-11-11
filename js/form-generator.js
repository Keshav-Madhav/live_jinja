import { state } from './state.js';
import { elements } from './dom.js';
import { setNestedValue } from './utils.js';
import { debounce } from './utils.js';

/**
 * Form generation and management
 */

/**
 * Creates form inputs for extracted variables
 */
export function createVariableForm(variableStructures, getCurrentVariablesCallback, syncFormToJsonCallback, autoRerenderToggle, updateCallback) {
    elements.variablesForm.innerHTML = '';
    
    if (Object.keys(variableStructures).length === 0) {
        elements.variablesForm.innerHTML = '<p style="color: #666; font-style: italic;">No variables found in template. Use {{ variable_name }} syntax.</p>';
        return;
    }
    
    function createInputsForStructure(structure, baseName = '', level = 0) {
        const container = document.createElement('div');
        container.style.marginLeft = `${level * 15}px`;
        
        if (Array.isArray(structure)) {
            // Handle arrays with textarea
            const label = document.createElement('label');
            label.textContent = `${baseName} (Array)`;
            label.style.fontWeight = 'bold';
            label.style.color = '#2196F3';
            label.style.display = 'block';
            label.style.marginBottom = '5px';
            container.appendChild(label);
            
            const textarea = document.createElement('textarea');
            textarea.id = `var-${baseName}`;
            textarea.name = baseName;
            textarea.value = JSON.stringify(structure, null, 2);
            textarea.placeholder = `JSON array for ${baseName}`;
            textarea.style.width = '100%';
            textarea.style.minHeight = '80px';
            textarea.style.padding = '6px 8px';
            textarea.style.border = '1px solid #e0e0e0';
            textarea.style.borderRadius = '4px';
            textarea.style.fontSize = '12px';
            textarea.style.fontFamily = '"Menlo", "Consolas", monospace';
            textarea.style.marginBottom = '15px';
            textarea.style.resize = 'vertical';
            
            textarea.addEventListener('input', function() {
                try {
                    const parsed = JSON.parse(this.value);
                    state.currentVariableValues[baseName] = parsed;
                    this.style.borderColor = '#e0e0e0';
                } catch (e) {
                    this.style.borderColor = '#d32f2f';
                    state.currentVariableValues[baseName] = this.value;
                }
                
                syncFormToJsonCallback();
                
                if (autoRerenderToggle.checked) {
                    debounce(updateCallback, 300)();
                }
            });
            
            container.appendChild(textarea);
            
        } else if (typeof structure === 'object' && structure !== null) {
            // Handle objects
            if (baseName) {
                const label = document.createElement('label');
                label.textContent = `${baseName} (Object)`;
                label.style.fontWeight = 'bold';
                label.style.color = '#4CAF50';
                label.style.display = 'block';
                label.style.marginBottom = '5px';
                container.appendChild(label);
            }
            
            const isSimpleObject = Object.values(structure).every(val => 
                typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean'
            );
            
            if (isSimpleObject && Object.keys(structure).length <= 5) {
                Object.entries(structure).forEach(([key, value]) => {
                    const inputDiv = document.createElement('div');
                    inputDiv.className = 'variable-input';
                    inputDiv.style.marginLeft = `${(level + 1) * 15}px`;
                    
                    const label = document.createElement('label');
                    label.textContent = `${baseName ? baseName + '.' : ''}${key}`;
                    label.style.fontSize = '11px';
                    label.style.color = '#666';
                    
                    const input = document.createElement('input');
                    input.type = typeof value === 'boolean' ? 'checkbox' : 'text';
                    input.id = `var-${baseName ? baseName + '.' : ''}${key}`;
                    input.name = `${baseName ? baseName + '.' : ''}${key}`;
                    
                    if (typeof value === 'boolean') {
                        input.checked = value;
                        input.addEventListener('change', function() {
                            setNestedValue(state.currentVariableValues, this.name, this.checked);
                            syncFormToJsonCallback();
                            if (autoRerenderToggle.checked) {
                                debounce(updateCallback, 300)();
                            }
                        });
                    } else {
                        input.value = value;
                        input.addEventListener('input', function() {
                            setNestedValue(state.currentVariableValues, this.name, this.value);
                            syncFormToJsonCallback();
                            if (autoRerenderToggle.checked) {
                                debounce(updateCallback, 300)();
                            }
                        });
                    }
                    
                    inputDiv.appendChild(label);
                    inputDiv.appendChild(input);
                    container.appendChild(inputDiv);
                });
            } else {
                // Complex object - use JSON textarea
                const textarea = document.createElement('textarea');
                textarea.id = `var-${baseName}`;
                textarea.name = baseName;
                textarea.value = JSON.stringify(structure, null, 2);
                textarea.placeholder = `JSON object for ${baseName}`;
                textarea.style.width = '100%';
                textarea.style.minHeight = '100px';
                textarea.style.padding = '6px 8px';
                textarea.style.border = '1px solid #e0e0e0';
                textarea.style.borderRadius = '4px';
                textarea.style.fontSize = '12px';
                textarea.style.fontFamily = '"Menlo", "Consolas", monospace';
                textarea.style.marginBottom = '15px';
                textarea.style.resize = 'vertical';
                
                textarea.addEventListener('input', function() {
                    try {
                        const parsed = JSON.parse(this.value);
                        state.currentVariableValues[baseName] = parsed;
                        this.style.borderColor = '#e0e0e0';
                    } catch (e) {
                        this.style.borderColor = '#d32f2f';
                        state.currentVariableValues[baseName] = this.value;
                    }
                    
                    syncFormToJsonCallback();
                    
                    if (autoRerenderToggle.checked) {
                        debounce(updateCallback, 300)();
                    }
                });
                
                container.appendChild(textarea);
            }
            
        } else {
            // Handle primitive values with type selection
            const inputDiv = document.createElement('div');
            inputDiv.className = 'variable-input';
            
            const headerDiv = document.createElement('div');
            headerDiv.className = 'variable-header';
            
            const label = document.createElement('label');
            label.textContent = baseName;
            label.setAttribute('for', `var-${baseName}`);
            
            const typeSelect = document.createElement('select');
            typeSelect.className = 'type-selector';
            
            const types = [
                { value: 'string', label: 'Text' },
                { value: 'number', label: 'Number' },
                { value: 'boolean', label: 'Boolean' },
                { value: 'json', label: 'JSON' }
            ];
            
            let currentType = 'string';
            if (typeof structure === 'boolean') {
                currentType = 'boolean';
            } else if (typeof structure === 'number') {
                currentType = 'number';
            } else if (typeof structure === 'object' && structure !== null) {
                currentType = 'json';
            }
            
            types.forEach(type => {
                const option = document.createElement('option');
                option.value = type.value;
                option.textContent = type.label;
                option.selected = type.value === currentType;
                typeSelect.appendChild(option);
            });
            
            headerDiv.appendChild(label);
            headerDiv.appendChild(typeSelect);
            inputDiv.appendChild(headerDiv);
            
            function createInputForType(type, value) {
                let input;
                
                if (type === 'boolean') {
                    input = document.createElement('input');
                    input.type = 'checkbox';
                    input.checked = Boolean(value);
                } else if (type === 'json') {
                    input = document.createElement('textarea');
                    input.value = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
                    input.style.minHeight = '80px';
                    input.style.resize = 'vertical';
                    input.style.fontFamily = '"Menlo", "Consolas", monospace';
                    input.style.fontSize = '12px';
                } else if (type === 'string' && String(value).length > 50) {
                    input = document.createElement('textarea');
                    input.value = String(value);
                    input.style.minHeight = '60px';
                    input.style.resize = 'vertical';
                } else {
                    input = document.createElement('input');
                    input.type = type === 'number' ? 'number' : 'text';
                    input.value = String(value);
                    input.placeholder = `Enter ${type} value for ${baseName}`;
                }
                
                input.id = `var-${baseName}`;
                input.name = baseName;
                input.style.width = '100%';
                input.style.padding = '6px 8px';
                input.style.border = '1px solid #e0e0e0';
                input.style.borderRadius = '4px';
                input.style.backgroundColor = 'var(--input-bg)';
                input.style.color = 'var(--text-color)';
                
                return input;
            }
            
            let currentInput = createInputForType(currentType, structure);
            
            function addInputListener(input, type) {
                const eventType = type === 'boolean' ? 'change' : 'input';
                input.addEventListener(eventType, function() {
                    let value = this.value;
                    
                    if (type === 'boolean') {
                        value = this.checked;
                    } else if (type === 'number') {
                        value = this.value === '' ? '' : Number(this.value);
                    } else if (type === 'json') {
                        try {
                            value = JSON.parse(this.value);
                            this.style.borderColor = '#e0e0e0';
                        } catch (e) {
                            this.style.borderColor = '#d32f2f';
                            value = this.value;
                        }
                    }
                    
                    state.currentVariableValues[baseName] = value;
                    syncFormToJsonCallback();
                    
                    if (autoRerenderToggle.checked) {
                        debounce(updateCallback, 300)();
                    }
                });
            }
            
            addInputListener(currentInput, currentType);
            
            typeSelect.addEventListener('change', function() {
                const newType = this.value;
                const oldInput = inputDiv.querySelector('input, textarea');
                let currentValue = state.currentVariableValues[baseName] || structure;
                
                if (newType === 'boolean') {
                    currentValue = Boolean(currentValue);
                } else if (newType === 'number') {
                    currentValue = currentValue === '' ? 0 : Number(currentValue) || 0;
                } else if (newType === 'string') {
                    currentValue = String(currentValue);
                } else if (newType === 'json') {
                    if (typeof currentValue !== 'object') {
                        try {
                            currentValue = JSON.parse(String(currentValue));
                        } catch (e) {
                            currentValue = String(currentValue);
                        }
                    }
                }
                
                const newInput = createInputForType(newType, currentValue);
                addInputListener(newInput, newType);
                
                oldInput.parentNode.replaceChild(newInput, oldInput);
                state.currentVariableValues[baseName] = currentValue;
                
                syncFormToJsonCallback();
                
                if (autoRerenderToggle.checked) {
                    debounce(updateCallback, 300)();
                }
            });
            
            inputDiv.appendChild(currentInput);
            container.appendChild(inputDiv);
        }
        
        return container;
    }
    
    Object.entries(variableStructures).forEach(([varName, structure]) => {
        const container = createInputsForStructure(structure, varName);
        elements.variablesForm.appendChild(container);
    });
}

/**
 * Syncs form data back to JSON editor in real-time
 */
export function syncFormToJson(isFormMode, getCurrentVariablesCallback, varsEditor, syncFormBtn) {
    if (isFormMode) {
        const currentVars = getCurrentVariablesCallback();
        const jsonString = JSON.stringify(currentVars, null, 2);
        
        if (varsEditor.getValue() !== jsonString) {
            varsEditor.setValue(jsonString);
            
            if (syncFormBtn && syncFormBtn.style.display !== 'none') {
                const originalText = syncFormBtn.textContent;
                syncFormBtn.textContent = '✓';
                syncFormBtn.style.color = '#10b981';
                setTimeout(() => {
                    syncFormBtn.textContent = originalText;
                    syncFormBtn.style.color = '';
                }, 500);
            }
        }
    }
}
