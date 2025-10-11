// Start with minimal template and variables
const defaultTemplate = `Hello {{ name }}!`;

const defaultVars = {
    name: "World"
};

// --- EDITOR SETUP ---
const commonEditorOptions = {
    lineNumbers: true,
    theme: 'material-darker',
    lineWrapping: true,
    viewportMargin: Infinity, // Render all content
    scrollbarStyle: 'native'
};

const jinjaEditor = CodeMirror.fromTextArea(document.getElementById('jinja-template'), {
    ...commonEditorOptions,
    mode: 'jinja2',
});

const varsEditor = CodeMirror.fromTextArea(document.getElementById('variables'), {
    ...commonEditorOptions,
    mode: { name: 'javascript', json: true },
});

jinjaEditor.setValue(defaultTemplate);
varsEditor.setValue(JSON.stringify(defaultVars, null, 2));

const outputElement = document.getElementById('output');
const markdownOutputElement = document.getElementById('markdown-output');
const loader = document.getElementById('loader');
const loadingOverlay = document.getElementById('loading-overlay');

// Pyodide setup
let pyodide = null;
let isInitialized = false;

// --- CONTROL ELEMENTS ---
const textWrapToggle = document.getElementById('text-wrap-toggle');
const autoRerenderToggle = document.getElementById('auto-rerender-toggle');
const manualRerenderBtn = document.getElementById('manual-rerender');
const extractVariablesBtn = document.getElementById('extract-variables-header');
const toggleModeBtn = document.getElementById('toggle-mode');
const variablesForm = document.getElementById('variables-form');
const variablesHeader = document.getElementById('variables-header');
const copyTemplateBtn = document.getElementById('copy-template-btn');
const copyOutputBtn = document.getElementById('copy-output-btn');
const showWhitespaceToggle = document.getElementById('show-whitespace-toggle');
const themeToggle = document.getElementById('theme-toggle');
const markdownToggle = document.getElementById('markdown-toggle');
const mermaidToggle = document.getElementById('mermaid-toggle');

// --- STATE MANAGEMENT ---
let isFormMode = false;
let extractedVariables = new Set();
let currentVariableValues = {};
let isMarkdownMode = false;
let isMermaidMode = false;
let lastRenderedOutput = '';

// Store debounced function references for proper event listener removal
let debouncedUpdateFromJinja = null;
let debouncedUpdateFromVars = null;

// --- RESIZE STATE ---
let isResizing = false;
let resizeType = null;
let startX = 0;
let startY = 0;
let startWidth = 0;
let startHeight = 0;

// --- MERMAID SETUP ---

// Initialize Mermaid with configuration
mermaid.initialize({
    startOnLoad: false,
    theme: document.body.classList.contains('dark-mode') ? 'dark' : 'default',
    securityLevel: 'loose',
    flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis'
    }
});

// --- PYODIDE SETUP ---

async function setupPyodide() {
    try {
        loader.style.display = 'block';
        loadingOverlay.style.display = 'block';
        
        pyodide = await loadPyodide();
        await pyodide.loadPackage("jinja2");
        
        isInitialized = true;
        loader.style.display = 'none';
        loadingOverlay.style.display = 'none';
        
        // Initial render after setup
        update();
    } catch (error) {
        loader.textContent = `Failed to load Python environment: ${error.message}`;
        loader.style.color = '#d32f2f';
    }
}

// --- CORE LOGIC ---

/**
 * Provides visual feedback for button clicks
 */
function showButtonFeedback(button, message = 'Done!', duration = 1500) {
    const originalText = button.textContent;
    const originalBackground = button.style.background || getComputedStyle(button).backgroundColor;
    
    button.textContent = message;
    button.style.background = '#4CAF50';
    button.disabled = true;
    
    setTimeout(() => {
        button.textContent = originalText;
        button.style.background = originalBackground;
        button.disabled = false;
    }, duration);
}

/**
 * Provides visual feedback for toggle switches
 */
function showToggleFeedback(toggleElement, message) {
    // Create a temporary tooltip-like element
    const feedback = document.createElement('div');
    feedback.textContent = message;
    feedback.style.cssText = `
        position: absolute;
        background: #4CAF50;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
        z-index: 1000;
        pointer-events: none;
        transform: translateX(-50%);
        white-space: nowrap;
    `;
    
    // Position relative to the toggle
    const rect = toggleElement.getBoundingClientRect();
    feedback.style.left = `${rect.left + rect.width / 2}px`;
    feedback.style.top = `${rect.top - 30}px`;
    
    document.body.appendChild(feedback);
    
    setTimeout(() => {
        if (feedback.parentNode) {
            feedback.parentNode.removeChild(feedback);
        }
    }, 1000);
}

/**
 * UPDATED: Renders text with visible whitespace characters without affecting layout.
 */
function renderWhitespace(text) {
    // First, escape any potential HTML in the text to prevent XSS
    const escapedText = text.replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/"/g, '&quot;')
                            .replace(/'/g, '&#039;');

    // Wrap whitespace characters in spans. The original characters are
    // preserved for layout, and CSS pseudo-elements add the visual symbols.
    return escapedText
        .replace(/ /g, '<span class="whitespace-char space"> </span>')
        .replace(/\t/g, '<span class="whitespace-char tab">\t</span>')
        .replace(/\n/g, '<span class="whitespace-char newline"></span>\n');
}

/**
 * Renders markdown with Mermaid diagram support
 */
async function renderMarkdown(text) {
    // Store the text for later use
    lastRenderedOutput = text;
    
    // Extract mermaid code blocks before markdown parsing
    const mermaidBlocks = [];
    const mermaidPlaceholder = text.replace(/```mermaid\n([\s\S]*?)```/g, (match, code) => {
        mermaidBlocks.push(code.trim());
        return `<div class="mermaid-placeholder" data-index="${mermaidBlocks.length - 1}"></div>`;
    });
    
    // Parse markdown
    const html = marked.parse(mermaidPlaceholder);
    
    // Insert HTML into the output element
    markdownOutputElement.innerHTML = html;
    
    // Replace placeholders with actual mermaid diagrams
    const placeholders = markdownOutputElement.querySelectorAll('.mermaid-placeholder');
    for (let i = 0; i < placeholders.length; i++) {
        const placeholder = placeholders[i];
        const index = parseInt(placeholder.getAttribute('data-index'));
        const code = mermaidBlocks[index];
        
        // Create a container for the mermaid diagram
        const mermaidDiv = document.createElement('div');
        mermaidDiv.className = 'mermaid';
        mermaidDiv.textContent = code;
        
        // Replace the placeholder
        placeholder.parentNode.replaceChild(mermaidDiv, placeholder);
    }
    
    // Render all mermaid diagrams
    try {
        await mermaid.run({
            querySelector: '.markdown-content .mermaid'
        });
    } catch (error) {
        console.error('Mermaid rendering error:', error);
    }
}

/**
 * Renders pure Mermaid diagram (assumes entire output is mermaid syntax)
 */
async function renderPureMermaid(text) {
    // Store the text for later use
    lastRenderedOutput = text;
    
    // Clear the markdown output and add a single mermaid diagram
    markdownOutputElement.innerHTML = '';
    
    // Create a container for the mermaid diagram
    const mermaidDiv = document.createElement('div');
    mermaidDiv.className = 'mermaid';
    mermaidDiv.textContent = text.trim();
    
    markdownOutputElement.appendChild(mermaidDiv);
    
    // Render the mermaid diagram
    try {
        await mermaid.run({
            querySelector: '.markdown-content .mermaid'
        });
    } catch (error) {
        console.error('Mermaid rendering error:', error);
        // Show error in a user-friendly way
        markdownOutputElement.innerHTML = `<div style="color: #d32f2f; padding: 20px; border: 2px solid #d32f2f; border-radius: 8px; margin: 20px;">
            <strong>⚠️ Mermaid Rendering Error</strong><br><br>
            ${error.message || 'Failed to render diagram'}<br><br>
            <small>Please check your Mermaid syntax.</small>
        </div>`;
    }
}

/**
 * Extracts variable names and structures from a Jinja template
 */
function extractVariablesFromTemplate(template) {
    const variableStructures = {};
    const referencedVariables = new Set(); // Track variables that are referenced (not just assigned)
    
    // Helper function to set nested property
    function setNestedProperty(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current)) {
                // Determine if next key is numeric (array index) or not
                const nextKey = keys[i + 1];
                current[key] = /^\d+$/.test(nextKey) ? [] : {};
            }
            current = current[key];
        }
        
        const lastKey = keys[keys.length - 1];
        if (Array.isArray(current) && /^\d+$/.test(lastKey)) {
            const index = parseInt(lastKey);
            while (current.length <= index) {
                current.push('');
            }
            current[index] = value;
        } else {
            current[lastKey] = value;
        }
    }

    // Helper function to safely set variable without overriding existing complex types
    function safeSetVariable(varName, newValue, allowOverride = false) {
        if (!(varName in variableStructures)) {
            variableStructures[varName] = newValue;
        } else if (allowOverride) {
            // Only override if the existing value is a simple type and new value is complex
            const existing = variableStructures[varName];
            const isExistingSimple = typeof existing === 'string' || typeof existing === 'boolean' || typeof existing === 'number';
            const isNewComplex = typeof newValue === 'object' && newValue !== null;
            
            if (isExistingSimple && isNewComplex) {
                variableStructures[varName] = newValue;
            }
        }
    }

    // 0. First pass: Extract {% set %} patterns to identify assignments vs references
    const setPattern = /\{\%\s*set\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*\%\}/g;
    let setMatch;
    
    while ((setMatch = setPattern.exec(template)) !== null) {
        const assignedVar = setMatch[1]; // This is a reference, not extracted
        const sourceVar = setMatch[2];   // This should be extracted
        
        // Mark the source variable for extraction
        const rootSourceVar = sourceVar.split('.')[0];
        referencedVariables.add(rootSourceVar);
        
        if (sourceVar.includes('.')) {
            // Source is an object property access
            safeSetVariable(rootSourceVar, {});
            setNestedProperty(variableStructures, sourceVar, '');
        } else {
            // Simple source variable
            safeSetVariable(rootSourceVar, '');
        }
    }
    
    // 1. Match {{ variable.property }} and {{ variable.property.nested }} patterns
    const variablePattern = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)(?:\s*\|\s*[^}]+)?\s*\}\}/g;
    let match;
    
    while ((match = variablePattern.exec(template)) !== null) {
        const fullPath = match[1];
        const rootVar = fullPath.split('.')[0];
        referencedVariables.add(rootVar);
        
        if (fullPath.includes('.')) {
            // This is an object property access
            safeSetVariable(rootVar, {}, true);
            setNestedProperty(variableStructures, fullPath, '');
        } else {
            // Simple variable
            safeSetVariable(rootVar, '');
        }
    }
    
    // 2. Match {% for item in variable %} patterns - indicates variable is a list/array
    const forPattern = /\{\%\s*for\s+\w+\s+in\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\%\}/g;
    while ((match = forPattern.exec(template)) !== null) {
        const varName = match[1];
        referencedVariables.add(varName);
        
        if (!(varName in variableStructures)) {
            variableStructures[varName] = ['']; // Single empty string for lists
        } else if (!Array.isArray(variableStructures[varName]) && typeof variableStructures[varName] !== 'object') {
            // Convert to array if it was a simple string
            variableStructures[varName] = [''];
        }
    }
    
    // 3. Match {% for key, value in variable.items() %} patterns - indicates variable is a dict
    const dictForPattern = /\{\%\s*for\s+\w+,\s*\w+\s+in\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\.\s*items\s*\(\s*\)\s*\%\}/g;
    while ((match = dictForPattern.exec(template)) !== null) {
        const varName = match[1];
        referencedVariables.add(varName);
        
        safeSetVariable(varName, { key1: 'value1', key2: 'value2' }, true);
    }
    
    // 4. Match {% if variable %} and {% if variable.property %} patterns
    const ifPattern = /\{\%\s*if\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)/g;
    while ((match = ifPattern.exec(template)) !== null) {
        const fullPath = match[1];
        const rootVar = fullPath.split('.')[0];
        referencedVariables.add(rootVar);
        
        if (fullPath.includes('.')) {
            // Property access - ensure root is an object
            safeSetVariable(rootVar, {}, true);
            setNestedProperty(variableStructures, fullPath, true); // Boolean for if conditions
        } else {
            // Simple variable in if condition - only set as boolean if not already a complex type
            if (!(rootVar in variableStructures)) {
                variableStructures[rootVar] = true; // Default boolean for if conditions
            }
            // Don't override existing objects/arrays with boolean when used in truthiness check
        }
    }
    
    // 5. Match array access patterns like {{ variable[0] }} or {{ variable.items[0] }}
    const arrayAccessPattern = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*\[\s*(\d+)\s*\](?:\s*\|\s*[^}]+)?\s*\}\}/g;
    while ((match = arrayAccessPattern.exec(template)) !== null) {
        const basePath = match[1];
        const index = parseInt(match[2]);
        const rootVar = basePath.split('.')[0];
        referencedVariables.add(rootVar);
        
        safeSetVariable(rootVar, basePath.includes('.') ? {} : [], true);
        
        // Create array structure
        const arrayPath = basePath + '.' + index;
        setNestedProperty(variableStructures, arrayPath, '');
    }
    
    // 6. Look for loop variables that access properties: {% for item in items %}{{ item.name }}{% endfor %}
    const loopWithPropertyPattern = /\{\%\s*for\s+(\w+)\s+in\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\%\}(.*?)\{\%\s*endfor\s*\%\}/gs;
    while ((match = loopWithPropertyPattern.exec(template)) !== null) {
        const loopVar = match[1];
        const arrayVar = match[2];
        const loopContent = match[3];
        referencedVariables.add(arrayVar);
        
        // Find properties accessed on the loop variable
        const loopVarPattern = new RegExp(`\\{\\{\\s*${loopVar}\\.([a-zA-Z_][a-zA-Z0-9_]*)`, 'g');
        let propMatch;
        const itemStructure = {};
        
        while ((propMatch = loopVarPattern.exec(loopContent)) !== null) {
            itemStructure[propMatch[1]] = '';
        }
        
        if (Object.keys(itemStructure).length > 0) {
            // Create array of objects
            safeSetVariable(arrayVar, [itemStructure, itemStructure], true);
        }
    }
    
    // Final step: Only return variables that were actually referenced in the template
    const finalVariableStructures = {};
    for (const [varName, structure] of Object.entries(variableStructures)) {
        if (referencedVariables.has(varName)) {
            finalVariableStructures[varName] = structure;
        }
    }
    
    return finalVariableStructures;
}

/**
 * Creates form inputs for extracted variables
 */
function createVariableForm(variableStructures) {
    variablesForm.innerHTML = '';
    
    if (Object.keys(variableStructures).length === 0) {
        variablesForm.innerHTML = '<p style="color: #666; font-style: italic;">No variables found in template. Use {{ variable_name }} syntax.</p>';
        return;
    }
    
    // Helper function to create form inputs recursively
    function createInputsForStructure(structure, baseName = '', level = 0) {
        const container = document.createElement('div');
        container.style.marginLeft = `${level * 15}px`;
        
        if (Array.isArray(structure)) {
            // Handle arrays
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
                    currentVariableValues[baseName] = parsed;
                    this.style.borderColor = '#e0e0e0';
                } catch (e) {
                    this.style.borderColor = '#d32f2f';
                    currentVariableValues[baseName] = this.value;
                }
                if (autoRerenderToggle.checked) {
                    debounce(update, 300)();
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
            
            // Check if it's a simple object (all values are primitives)
            const isSimpleObject = Object.values(structure).every(val => 
                typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean'
            );
            
            if (isSimpleObject && Object.keys(structure).length <= 5) {
                // Create individual inputs for simple objects
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
                            const path = this.name.split('.');
                            let current = currentVariableValues;
                            for (let i = 0; i < path.length - 1; i++) {
                                if (!(path[i] in current)) current[path[i]] = {};
                                current = current[path[i]];
                            }
                            current[path[path.length - 1]] = this.checked;
                            if (autoRerenderToggle.checked) {
                                debounce(update, 300)();
                            }
                        });
                    } else {
                        input.value = value;
                        input.addEventListener('input', function() {
                            const path = this.name.split('.');
                            let current = currentVariableValues;
                            for (let i = 0; i < path.length - 1; i++) {
                                if (!(path[i] in current)) current[path[i]] = {};
                                current = current[path[i]];
                            }
                            current[path[path.length - 1]] = this.value;
                            if (autoRerenderToggle.checked) {
                                debounce(update, 300)();
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
                        currentVariableValues[baseName] = parsed;
                        this.style.borderColor = '#e0e0e0';
                    } catch (e) {
                        this.style.borderColor = '#d32f2f';
                        currentVariableValues[baseName] = this.value;
                    }
                    if (autoRerenderToggle.checked) {
                        debounce(update, 300)();
                    }
                });
                
                container.appendChild(textarea);
            }
            
        } else {
            // Handle primitive values
            const inputDiv = document.createElement('div');
            inputDiv.className = 'variable-input';
            
            const label = document.createElement('label');
            label.textContent = baseName;
            label.setAttribute('for', `var-${baseName}`);
            
            const input = document.createElement(typeof structure === 'boolean' ? 'input' : 
                (typeof structure === 'string' && structure.length > 50) ? 'textarea' : 'input');
            
            input.id = `var-${baseName}`;
            input.name = baseName;
            
            if (typeof structure === 'boolean') {
                input.type = 'checkbox';
                input.checked = structure;
                input.addEventListener('change', function() {
                    currentVariableValues[baseName] = this.checked;
                    if (autoRerenderToggle.checked) {
                        debounce(update, 300)();
                    }
                });
            } else {
                if (input.tagName === 'TEXTAREA') {
                    input.value = structure;
                    input.style.minHeight = '60px';
                    input.style.resize = 'vertical';
                } else {
                    input.type = 'text';
                    input.value = structure;
                    input.placeholder = `Enter value for ${baseName}`;
                }
                
        input.addEventListener('input', function() {
                    currentVariableValues[baseName] = this.value;
            if (autoRerenderToggle.checked) {
                        debounce(update, 300)();
            }
        });
            }
        
        inputDiv.appendChild(label);
        inputDiv.appendChild(input);
            container.appendChild(inputDiv);
        }
        
        return container;
    }
    
    // Create inputs for each top-level variable
    Object.entries(variableStructures).forEach(([varName, structure]) => {
        const container = createInputsForStructure(structure, varName);
        variablesForm.appendChild(container);
    });
}

/**
 * Gets current variable values from form or JSON
 */
function getCurrentVariables() {
    if (isFormMode) {
        const formData = {};
        variablesForm.querySelectorAll('input, textarea').forEach(input => {
            const varName = input.name;
            let value = input.value;
            
            // Try to parse as JSON if it looks like JSON
            if (value.trim().startsWith('{') || value.trim().startsWith('[') || 
                value === 'true' || value === 'false' || 
                (value.trim() && !isNaN(value.trim()))) {
                try {
                    value = JSON.parse(value);
                } catch (e) {
                    // Keep as string if not valid JSON
                }
            }
            
            formData[varName] = value;
        });
        return formData;
    } else {
        try {
            return JSON.parse(varsEditor.getValue() || '{}');
        } catch (e) {
            return {};
        }
    }
}

/**
 * The main function to update the rendering. It gets triggered on any change.
 */
async function update() {
    if (!pyodide || !isInitialized) {
        outputElement.textContent = 'Python environment is still loading...';
        outputElement.className = '';
        return;
    }

    const template = jinjaEditor.getValue();
    let context;

    // 1. Get variables from current mode (form or JSON)
    try {
        context = getCurrentVariables();
    } catch (e) {
        // If there's an error getting variables, show it
        outputElement.textContent = `Error in variables:\n${e.message}`;
        outputElement.className = 'error';
        return;
    }

    // 2. Render the template with the context using Python Jinja2
    try {
        const contextJson = JSON.stringify(context);
        
        // Escape template and context strings for Python
        const escapedTemplate = template.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
        const escapedContext = contextJson.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        
        const result = pyodide.runPython(`
import jinja2
import json

try:
    template_str = """${escapedTemplate}"""
    context_str = """${escapedContext}"""
    
    template = jinja2.Template(template_str)
    context = json.loads(context_str)
    result = template.render(context)
except jinja2.exceptions.TemplateError as e:
    result = f"Jinja2 Template Error: {e}"
except json.JSONDecodeError as e:
    result = f"JSON Error: {e}"
except Exception as e:
    result = f"Error: {e}"

result
        `);
        
        // Store the result
        lastRenderedOutput = result;
        
        // Set the main content based on mode
        if (isMermaidMode) {
            // Render as pure mermaid diagram
            outputElement.style.display = 'none';
            markdownOutputElement.style.display = 'block';
            await renderPureMermaid(result);
        } else if (isMarkdownMode) {
            // Render as markdown
            outputElement.style.display = 'none';
            markdownOutputElement.style.display = 'block';
            await renderMarkdown(result);
        } else {
            // Render as plain text
            outputElement.style.display = 'block';
            markdownOutputElement.style.display = 'none';
            
            if (showWhitespaceToggle.checked) {
                outputElement.innerHTML = renderWhitespace(result);
            } else {
                outputElement.textContent = result;
            }
            outputElement.className = result.includes('Error:') ? 'error' : '';
        }
    } catch (e) {
        outputElement.textContent = `Python execution error: ${e.message}`;
        outputElement.className = 'error';
    }
}

// --- CONTROL HANDLERS ---

// Extract variables button
extractVariablesBtn.addEventListener('click', function() {
    const template = jinjaEditor.getValue();
    const newVariableStructures = extractVariablesFromTemplate(template);
    
    // Get current values from the active mode (form or JSON)
    const currentValues = getCurrentVariables();
    
    // Merge existing values with new structure, preserving user data where possible
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
    
    // Update state
    extractedVariables = new Set(Object.keys(newVariableStructures));
    currentVariableValues = mergedVariables;
    
    // If in form mode, recreate the form
    if (isFormMode) {
        createVariableForm(newVariableStructures);
    }
    
    // Update JSON editor to reflect current values
    varsEditor.setValue(JSON.stringify(mergedVariables, null, 2));
    
    // Re-render
    update();

    // Show feedback
    const variableCount = Object.keys(newVariableStructures).length;
    const message = variableCount > 0 ? `Found ${variableCount} variable${variableCount !== 1 ? 's' : ''}!` : 'No variables found!';
    showButtonFeedback(this, message, 2000);
});

// Mode toggle button
toggleModeBtn.addEventListener('click', function() {
    const wasFormMode = isFormMode;
    isFormMode = !isFormMode;
    
    if (isFormMode) {
        // Switch to form mode
        varsEditor.getWrapperElement().style.display = 'none';
        variablesForm.style.display = 'block';
        toggleModeBtn.textContent = 'Switch to JSON Mode';
        variablesHeader.textContent = 'Variables (Form)';
        
        // Get current variables from JSON and update our state
        try {
            const currentVars = JSON.parse(varsEditor.getValue() || '{}');
            currentVariableValues = currentVars;
            
            // Convert to the structure format expected by createVariableForm
            const variableStructures = {};
            Object.keys(currentVars).forEach(key => {
                variableStructures[key] = currentVars[key];
            });
            
            extractedVariables = new Set(Object.keys(currentVars));
        
        // Create form with current variables
            createVariableForm(variableStructures);
        } catch (e) {
            // If JSON is invalid, keep existing state or create empty form
            createVariableForm({});
        }
    } else {
        // Switch to JSON mode
        varsEditor.getWrapperElement().style.display = 'block';
        variablesForm.style.display = 'none';
        toggleModeBtn.textContent = 'Switch to Form Mode';
        variablesHeader.textContent = 'Variables (JSON)';
        
        // Update JSON editor with current form values
        const currentVars = getCurrentVariables();
        varsEditor.setValue(JSON.stringify(currentVars, null, 2));
    }

    // Show feedback
    const mode = isFormMode ? 'Form' : 'JSON';
    showButtonFeedback(this, `Switched to ${mode}!`, 1500);
});

// Text wrap toggle
textWrapToggle.addEventListener('change', function() {
    const wrapMode = this.checked;
    jinjaEditor.setOption('lineWrapping', wrapMode);
    varsEditor.setOption('lineWrapping', wrapMode);
    
    // Show feedback
    const message = wrapMode ? 'Text wrap enabled!' : 'Text wrap disabled!';
    showToggleFeedback(this.parentElement, message);
});

// Whitespace toggle
showWhitespaceToggle.addEventListener('change', function() {
    update(); // Re-render the output with the new setting
    const message = this.checked ? 'Whitespace visible' : 'Whitespace hidden';
    showToggleFeedback(this.parentElement, message);
});

// Markdown toggle
markdownToggle.addEventListener('change', async function() {
    if (this.checked) {
        // Disable mermaid mode if it's on
        if (isMermaidMode) {
            mermaidToggle.checked = false;
            isMermaidMode = false;
        }
        
        isMarkdownMode = true;
        
        // Switch to markdown mode
        outputElement.style.display = 'none';
        markdownOutputElement.style.display = 'block';
        
        // If we have output, render it as markdown
        if (lastRenderedOutput) {
            await renderMarkdown(lastRenderedOutput);
        }
        
        // Disable whitespace toggle in markdown mode
        showWhitespaceToggle.disabled = true;
        showWhitespaceToggle.parentElement.style.opacity = '0.5';
        
        // Show feedback
        showToggleFeedback(this.parentElement, 'Markdown mode enabled!');
    } else {
        isMarkdownMode = false;
        
        // Switch to plain text mode
        outputElement.style.display = 'block';
        markdownOutputElement.style.display = 'none';
        
        // Re-render as plain text
        if (lastRenderedOutput) {
            if (showWhitespaceToggle.checked) {
                outputElement.innerHTML = renderWhitespace(lastRenderedOutput);
            } else {
                outputElement.textContent = lastRenderedOutput;
            }
            outputElement.className = lastRenderedOutput.includes('Error:') ? 'error' : '';
        }
        
        // Re-enable whitespace toggle
        showWhitespaceToggle.disabled = false;
        showWhitespaceToggle.parentElement.style.opacity = '1';
        
        // Show feedback
        showToggleFeedback(this.parentElement, 'Plain text mode enabled!');
    }
});

// Mermaid toggle
mermaidToggle.addEventListener('change', async function() {
    if (this.checked) {
        // Disable markdown mode if it's on
        if (isMarkdownMode) {
            markdownToggle.checked = false;
            isMarkdownMode = false;
        }
        
        isMermaidMode = true;
        
        // Switch to mermaid mode
        outputElement.style.display = 'none';
        markdownOutputElement.style.display = 'block';
        
        // If we have output, render it as mermaid
        if (lastRenderedOutput) {
            await renderPureMermaid(lastRenderedOutput);
        }
        
        // Disable whitespace toggle in mermaid mode
        showWhitespaceToggle.disabled = true;
        showWhitespaceToggle.parentElement.style.opacity = '0.5';
        
        // Show feedback
        showToggleFeedback(this.parentElement, 'Mermaid mode enabled!');
    } else {
        isMermaidMode = false;
        
        // Switch to plain text mode
        outputElement.style.display = 'block';
        markdownOutputElement.style.display = 'none';
        
        // Re-render as plain text
        if (lastRenderedOutput) {
            if (showWhitespaceToggle.checked) {
                outputElement.innerHTML = renderWhitespace(lastRenderedOutput);
            } else {
                outputElement.textContent = lastRenderedOutput;
            }
            outputElement.className = lastRenderedOutput.includes('Error:') ? 'error' : '';
        }
        
        // Re-enable whitespace toggle
        showWhitespaceToggle.disabled = false;
        showWhitespaceToggle.parentElement.style.opacity = '1';
        
        // Show feedback
        showToggleFeedback(this.parentElement, 'Plain text mode enabled!');
    }
});

// Auto rerender toggle
autoRerenderToggle.addEventListener('change', function() {
    manualRerenderBtn.disabled = this.checked;
    setupEventListeners();
    
    // Show feedback
    const message = this.checked ? 'Auto rerender enabled!' : 'Auto rerender disabled!';
    showToggleFeedback(this.parentElement, message);
});

// Manual rerender button
manualRerenderBtn.addEventListener('click', function() {
    update();
    showButtonFeedback(this, 'Rerendered!', 1000);
});

// Copy template button
copyTemplateBtn.addEventListener('click', async function() {
    try {
        const templateContent = jinjaEditor.getValue();
        await navigator.clipboard.writeText(templateContent);
        
        // Visual feedback
        const originalText = this.textContent;
        this.textContent = 'Copied!';
        this.style.background = '#4CAF50';
        
        setTimeout(() => {
            this.textContent = originalText;
            this.style.background = '#2196F3';
        }, 1500);
    } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = jinjaEditor.getValue();
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        // Visual feedback
        const originalText = this.textContent;
        this.textContent = 'Copied!';
        this.style.background = '#4CAF50';
        
        setTimeout(() => {
            this.textContent = originalText;
            this.style.background = '#2196F3';
        }, 1500);
    }
});

// Copy output button
copyOutputBtn.addEventListener('click', async function() {
    try {
        const outputContent = outputElement.textContent;
        await navigator.clipboard.writeText(outputContent);
        
        // Visual feedback
        const originalText = this.textContent;
        this.textContent = 'Copied!';
        this.style.background = '#4CAF50';
        
        setTimeout(() => {
            this.textContent = originalText;
            this.style.background = '#2196F3';
        }, 1500);
    } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = outputElement.textContent;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        // Visual feedback
        const originalText = this.textContent;
        this.textContent = 'Copied!';
        this.style.background = '#4CAF50';
        
        setTimeout(() => {
            this.textContent = originalText;
            this.style.background = '#2196F3';
        }, 1500);
    }
});

// Theme toggle
themeToggle.addEventListener('change', function() {
    const isLightMode = this.checked;
    
    if (isLightMode) {
        // Switch to light mode
        document.body.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light');
        jinjaEditor.setOption('theme', 'default');
        varsEditor.setOption('theme', 'default');
        
        // Update Mermaid theme
        mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true,
                curve: 'basis'
            }
        });
    } else {
        // Switch to dark mode
        document.body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
        jinjaEditor.setOption('theme', 'material-darker');
        varsEditor.setOption('theme', 'material-darker');
        
        // Update Mermaid theme
        mermaid.initialize({
            startOnLoad: false,
            theme: 'dark',
            securityLevel: 'loose',
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true,
                curve: 'basis'
            }
        });
    }
    
    // If in markdown or mermaid mode, re-render to apply new Mermaid theme
    if (isMarkdownMode && lastRenderedOutput) {
        renderMarkdown(lastRenderedOutput);
    } else if (isMermaidMode && lastRenderedOutput) {
        renderPureMermaid(lastRenderedOutput);
    }
    
    // Refresh CodeMirror editors to apply theme
    setTimeout(() => {
        jinjaEditor.refresh();
        varsEditor.refresh();
    }, 10);
});

// --- EVENT LISTENERS ---
// Conditional event listeners based on auto-rerender setting
function setupEventListeners() {
    // Remove any existing listeners first
    if (debouncedUpdateFromJinja) {
        jinjaEditor.off('change', debouncedUpdateFromJinja);
    }
    if (debouncedUpdateFromVars) {
        varsEditor.off('change', debouncedUpdateFromVars);
    }
    
    if (autoRerenderToggle.checked) {
        // Create new debounced functions and store references
        debouncedUpdateFromJinja = debounce(update, 300);
        debouncedUpdateFromVars = debounce(update, 300);
        
        // Add the event listeners
        jinjaEditor.on('change', debouncedUpdateFromJinja);
        varsEditor.on('change', debouncedUpdateFromVars);
    } else {
        // Clear the references when disabled
        debouncedUpdateFromJinja = null;
        debouncedUpdateFromVars = null;
    }
}

// Debounce function to prevent too frequent updates
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// --- RESIZE FUNCTIONALITY ---

// Get resize elements
const horizontalResize = document.getElementById('horizontal-resize');
const verticalResize = document.getElementById('vertical-resize');
const leftPanel = document.getElementById('left-panel');
const rightPanel = document.getElementById('right-panel');
const templatePane = document.getElementById('template-pane');
const variablesPane = document.getElementById('variables-pane');
const mainContainer = document.getElementById('main-container');

// Initialize default sizes
let leftPanelWidth = 50; // percentage
let templatePaneHeight = 60; // percentage

function setInitialSizes() {
    const containerRect = mainContainer.getBoundingClientRect();
    leftPanel.style.width = `${leftPanelWidth}%`;
    rightPanel.style.width = `${100 - leftPanelWidth}%`;
    
    const leftPanelRect = leftPanel.getBoundingClientRect();
    templatePane.style.height = `${templatePaneHeight}%`;
    variablesPane.style.height = `${100 - templatePaneHeight}%`;
}

// Horizontal resize (between template and variables)
horizontalResize.addEventListener('mousedown', function(e) {
    isResizing = true;
    resizeType = 'horizontal';
    startY = e.clientY;
    
    const leftPanelRect = leftPanel.getBoundingClientRect();
    const templateRect = templatePane.getBoundingClientRect();
    startHeight = templateRect.height;
    
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
    e.preventDefault();
});

// Vertical resize (between left and right panels)
verticalResize.addEventListener('mousedown', function(e) {
    isResizing = true;
    resizeType = 'vertical';
    startX = e.clientX;
    
    const containerRect = mainContainer.getBoundingClientRect();
    const leftRect = leftPanel.getBoundingClientRect();
    startWidth = leftRect.width;
    
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
    e.preventDefault();
});

function handleResize(e) {
    if (!isResizing) return;
    
    if (resizeType === 'horizontal') {
        const deltaY = e.clientY - startY;
        const leftPanelRect = leftPanel.getBoundingClientRect();
        const newTemplateHeight = startHeight + deltaY;
        const minHeight = 100;
        const maxHeight = leftPanelRect.height - minHeight - 4; // 4px for resize handle
        
        if (newTemplateHeight >= minHeight && newTemplateHeight <= maxHeight) {
            const templatePercentage = (newTemplateHeight / leftPanelRect.height) * 100;
            const variablesPercentage = 100 - templatePercentage;
            
            templatePane.style.height = `${templatePercentage}%`;
            variablesPane.style.height = `${variablesPercentage}%`;
            templatePaneHeight = templatePercentage;
        }
    } else if (resizeType === 'vertical') {
        const deltaX = e.clientX - startX;
        const containerRect = mainContainer.getBoundingClientRect();
        const newLeftWidth = startWidth + deltaX;
        const minWidth = 200;
        const maxWidth = containerRect.width - minWidth - 4; // 4px for resize handle
        
        if (newLeftWidth >= minWidth && newLeftWidth <= maxWidth) {
            const leftPercentage = (newLeftWidth / containerRect.width) * 100;
            const rightPercentage = 100 - leftPercentage;
            
            leftPanel.style.width = `${leftPercentage}%`;
            rightPanel.style.width = `${rightPercentage}%`;
            leftPanelWidth = leftPercentage;
        }
    }
    
    // Refresh CodeMirror editors after resize
    setTimeout(() => {
        jinjaEditor.refresh();
        varsEditor.refresh();
    }, 10);
}

function stopResize() {
    isResizing = false;
    resizeType = null;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
}

// Handle window resize
window.addEventListener('resize', function() {
    setTimeout(() => {
        jinjaEditor.refresh();
        varsEditor.refresh();
    }, 100);
});

// Initial setup
setInitialSizes();
setupEventListeners();

// Load saved theme preference
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') {
    document.body.classList.remove('dark-mode');
    themeToggle.checked = true;
    jinjaEditor.setOption('theme', 'default');
    varsEditor.setOption('theme', 'default');
} else {
    // Default to dark mode
    document.body.classList.add('dark-mode');
    themeToggle.checked = false;
    jinjaEditor.setOption('theme', 'material-darker');
    varsEditor.setOption('theme', 'material-darker');
}

// Start Pyodide and initial render
setupPyodide();