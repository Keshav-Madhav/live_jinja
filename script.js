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
const syncFormBtn = document.getElementById('sync-form-btn');
const variablesForm = document.getElementById('variables-form');
const variablesHeader = document.getElementById('variables-header');
const copyTemplateBtn = document.getElementById('copy-template-btn');
const copyOutputBtn = document.getElementById('copy-output-btn');
const showWhitespaceToggle = document.getElementById('show-whitespace-toggle');
const removeExtraWhitespaceToggle = document.getElementById('remove-extra-whitespace-toggle');
const themeToggle = document.getElementById('theme-toggle');
const markdownToggle = document.getElementById('markdown-toggle');
const mermaidToggle = document.getElementById('mermaid-toggle');
const saveConfigBtn = document.getElementById('save-config-btn');
const shareCurrentBtn = document.getElementById('share-current-btn');
const saveModalOverlay = document.getElementById('save-modal-overlay');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalSaveBtn = document.getElementById('modal-save-btn');
const configNameInput = document.getElementById('config-name');
const burgerMenuBtn = document.getElementById('burger-menu-btn');
const drawerOverlay = document.getElementById('drawer-overlay');
const savedConfigsDrawer = document.getElementById('saved-configs-drawer');
const drawerCloseBtn = document.getElementById('drawer-close-btn');
const drawerContent = document.getElementById('drawer-content');
const drawerEmptyMessage = document.getElementById('drawer-empty-message');
const renameModalOverlay = document.getElementById('rename-modal-overlay');
const renameModalCloseBtn = document.getElementById('rename-modal-close-btn');
const renameModalCancelBtn = document.getElementById('rename-modal-cancel-btn');
const renameModalSaveBtn = document.getElementById('rename-modal-save-btn');
const renameConfigNameInput = document.getElementById('rename-config-name');
const jinjaVersionSelect = document.getElementById('jinja-version-select');
const customJinjaSelect = document.getElementById('custom-jinja-select');
const customSelectTrigger = customJinjaSelect.querySelector('.custom-select-trigger');
const selectedVersionText = document.getElementById('selected-version-text');
const versionOptions = document.getElementById('version-options');
const conflictModalOverlay = document.getElementById('conflict-modal-overlay');
const conflictModalCloseBtn = document.getElementById('conflict-modal-close-btn');
const conflictOverrideBtn = document.getElementById('conflict-override-btn');
const conflictSaveNewBtn = document.getElementById('conflict-save-new-btn');
const conflictNameDisplay = document.getElementById('conflict-name-display');
const conflictNewNameInput = document.getElementById('conflict-new-name-input');
const conflictButtonName = document.getElementById('conflict-button-name');
const conflictInputHint = document.getElementById('conflict-input-hint');

// --- STATE MANAGEMENT ---
let isFormMode = false;
let extractedVariables = new Set();
let currentVariableValues = {};
let isMarkdownMode = false;
let isMermaidMode = false;
let lastRenderedOutput = '';
let currentRenameIndex = null; // Track which config is being renamed
let conflictContext = null; // Track conflict resolution context

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
        curve: 'basis',
        wrap: true
    },
    themeVariables: {
        fontSize: '14px'
    }
});

// --- PYODIDE SETUP ---

let currentJinjaVersion = 'latest';

async function setupPyodide() {
    try {
        loader.style.display = 'block';
        loadingOverlay.style.display = 'block';
        
        pyodide = await loadPyodide();
        await installJinja2Version(currentJinjaVersion);
        
        isInitialized = true;
        loader.style.display = 'none';
        loadingOverlay.style.display = 'none';
        
        // Check for shared configuration in URL
        loadFromUrlParam();
        
        // Initial render after setup
        update();
    } catch (error) {
        loader.textContent = `Failed to load Python environment: ${error.message}`;
        loader.style.color = '#d32f2f';
    }
}

async function installJinja2Version(version) {
    try {
        // Show loading message
        loader.textContent = `Loading Jinja2 ${version === 'latest' ? 'latest' : 'v' + version}...`;
        
        // Install the specific version
        if (version === 'latest') {
            await pyodide.loadPackage("jinja2");
        } else {
            // Load micropip first if not already loaded
            await pyodide.loadPackage("micropip");
            
            // Uninstall existing jinja2 if it's already loaded (for version switching)
            if (isInitialized) {
                try {
                    await pyodide.runPythonAsync(`
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
            await pyodide.runPythonAsync(`
                import micropip
                await micropip.install('jinja2==${version}')
            `);
        }
        
        currentJinjaVersion = version;
        
        // Verify installation and show version
        const installedVersion = await pyodide.runPythonAsync(`
            import jinja2
            jinja2.__version__
        `);
        
        console.log(`Jinja2 version ${installedVersion} installed successfully`);
        
    } catch (error) {
        console.error('Failed to install Jinja2:', error);
        throw error;
    }
}

// --- CORE LOGIC ---

/**
 * Provides visual feedback for button clicks
 */
function showButtonFeedback(button, message = 'Done!', duration = 1500) {
    const originalText = button.textContent;
    const originalBackground = button.style.background || getComputedStyle(button).backgroundColor;
    
    const successColor = getComputedStyle(document.documentElement).getPropertyValue('--success-color').trim();
    
    button.textContent = message;
    button.style.background = successColor;
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
    const successColor = getComputedStyle(document.documentElement).getPropertyValue('--success-color').trim();
    
    // Create a temporary tooltip-like element
    const feedback = document.createElement('div');
    feedback.textContent = message;
    feedback.style.cssText = `
        position: absolute;
        background: ${successColor};
        color: white;
        padding: 6px 10px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 500;
        z-index: 1000;
        pointer-events: none;
        transform: translateX(-50%);
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    `;
    
    // Position relative to the toggle
    const rect = toggleElement.getBoundingClientRect();
    feedback.style.left = `${rect.left + rect.width / 2}px`;
    feedback.style.top = `${rect.top - 35}px`;
    
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
 * Removes extra whitespace (multiple newlines, spaces, and tabs)
 * Also handles alternating patterns like space-newline-space-newline
 */
function removeExtraWhitespace(text) {
    return text
        // First pass: collapse lines that only contain whitespace (spaces/tabs) into empty lines
        .replace(/^[ \t]+$/gm, '')
        // Second pass: replace multiple consecutive empty lines with at most 2 newlines
        .replace(/\n{3,}/g, '\n\n')
        // Third pass: replace multiple spaces with single space
        .replace(/ {2,}/g, ' ')
        // Fourth pass: replace multiple tabs with single tab
        .replace(/\t{2,}/g, '\t')
        // Fifth pass: clean up any remaining whitespace-only lines followed by more newlines
        .replace(/\n[ \t]*\n[ \t]*\n/g, '\n\n');
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
    
    // Jinja2 keywords and operators that should NOT be treated as variables
    const jinjaKeywords = new Set([
        // Control structures
        'if', 'elif', 'else', 'endif', 'for', 'endfor', 'while', 'endwhile',
        'set', 'endset', 'block', 'endblock', 'extends', 'include', 'import',
        'from', 'macro', 'endmacro', 'call', 'endcall', 'filter', 'endfilter',
        'with', 'endwith', 'autoescape', 'endautoescape', 'raw', 'endraw',
        'trans', 'endtrans', 'pluralize',
        
        // Operators and logical keywords
        'not', 'and', 'or', 'in', 'is', 'true', 'false', 'none', 'null',
        'True', 'False', 'None', 'NULL',
        
        // Built-in tests
        'defined', 'undefined', 'none', 'boolean', 'false', 'true', 'integer',
        'float', 'number', 'string', 'sequence', 'iterable', 'mapping',
        'sameas', 'escaped', 'odd', 'even', 'divisibleby', 'equalto',
        
        // Built-in functions (common ones)
        'range', 'lipsum', 'dict', 'cycler', 'joiner', 'len', 'abs', 'round',
        'min', 'max', 'sum', 'list', 'tuple', 'set', 'sorted', 'reversed',
        'enumerate', 'zip', 'filter', 'map', 'any', 'all',
        
        // Loop variables
        'loop'
    ]);
    
    // Helper function to check if a variable name is a Jinja keyword
    function isJinjaKeyword(varName) {
        return jinjaKeywords.has(varName.toLowerCase());
    }
    
    // Helper function to extract variables from a boolean expression
    function extractVariablesFromExpression(expression) {
        const variables = [];
        
        // Remove string literals first to avoid false matches
        let cleanedExpression = expression
            .replace(/'[^']*'/g, '')  // Remove single-quoted strings
            .replace(/"[^"]*"/g, '')  // Remove double-quoted strings
            .replace(/\b\d+\.?\d*\b/g, '')  // Remove numbers
            .replace(/\s+(?:and|or|not|in|is|==|!=|<=|>=|<|>)\s+/gi, ' ')  // Remove operators
            .replace(/\s*[\(\)\[\]]\s*/g, ' ')  // Remove parentheses and brackets
            .replace(/\s+/g, ' ')  // Normalize spaces
            .trim();
            
        // Handle function calls separately - extract variables from function arguments
        const functionCallPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*([^)]*)\s*\)/g;
        let funcMatch;
        while ((funcMatch = functionCallPattern.exec(expression)) !== null) {
            const funcName = funcMatch[1];
            const args = funcMatch[2];
            
            // If it's not a built-in function, treat the function name as a variable
            if (!isJinjaKeyword(funcName)) {
                variables.push(funcName);
            }
            
            // Extract variables from function arguments
            if (args.trim()) {
                const argVariables = extractVariablesFromExpression(args);
                variables.push(...argVariables);
            }
        }
        
        // Extract variable patterns
        const varMatches = cleanedExpression.match(/\b[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*/g);
        
        if (varMatches) {
            for (const match of varMatches) {
                const rootVar = match.split('.')[0];
                if (!isJinjaKeyword(rootVar)) {
                    variables.push(match);
                }
            }
        }
        
        return variables;
    }
    
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
        
        // Skip if it's a Jinja keyword
        if (isJinjaKeyword(rootSourceVar)) {
            continue;
        }
        
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
    
    // 1. Match {{ variable.property }} and {{ variable.property.nested }} patterns (with filters)
    const variablePattern = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)(?:\s*\|[^}]+)?\s*\}\}/g;
    let match;
    
    while ((match = variablePattern.exec(template)) !== null) {
        const fullPath = match[1];
        const rootVar = fullPath.split('.')[0];
        
        // Skip if it's a Jinja keyword
        if (isJinjaKeyword(rootVar)) {
            continue;
        }
        
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
        
        // Skip if it's a Jinja keyword
        if (isJinjaKeyword(varName)) {
            continue;
        }
        
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
        
        // Skip if it's a Jinja keyword
        if (isJinjaKeyword(varName)) {
            continue;
        }
        
        referencedVariables.add(varName);
        
        safeSetVariable(varName, { key1: 'value1', key2: 'value2' }, true);
    }
    
    // 4. Match {% if ... %} and {% elif ... %} patterns to extract variables from conditions
    const ifConditionPattern = /\{\%\s*(?:el)?if\s+([^%]+)\s*\%\}/g;
    while ((match = ifConditionPattern.exec(template)) !== null) {
        const condition = match[1];
        const variablesInCondition = extractVariablesFromExpression(condition);
        
        for (const fullPath of variablesInCondition) {
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
    }
    
    // 5. Match array access patterns like {{ variable[0] }} or {{ variable.items[0] }}
    const arrayAccessPattern = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*\[\s*(\d+)\s*\](?:\s*\|\s*[^}]+)?\s*\}\}/g;
    while ((match = arrayAccessPattern.exec(template)) !== null) {
        const basePath = match[1];
        const index = parseInt(match[2]);
        const rootVar = basePath.split('.')[0];
        
        // Skip if it's a Jinja keyword
        if (isJinjaKeyword(rootVar)) {
            continue;
        }
        
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
        
        // Skip if it's a Jinja keyword
        if (isJinjaKeyword(arrayVar)) {
            continue;
        }
        
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
 * Helper function to set nested object values using dot notation
 */
function setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
        if (!(keys[i] in current) || typeof current[keys[i]] !== 'object') {
            current[keys[i]] = {};
        }
        current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
}

/**
 * Syncs form data back to JSON editor in real-time
 */
function syncFormToJson() {
    if (isFormMode) {
        const currentVars = getCurrentVariables();
        const jsonString = JSON.stringify(currentVars, null, 2);
        
        // Only update if content actually changed to avoid cursor jumping
        if (varsEditor.getValue() !== jsonString) {
            varsEditor.setValue(jsonString);
            
            // Add visual feedback for sync
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
                
                // Sync to JSON editor
                syncFormToJson();
                
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
                            setNestedValue(currentVariableValues, this.name, this.checked);
                            
                            // Sync to JSON editor
                            syncFormToJson();
                            
                            if (autoRerenderToggle.checked) {
                                debounce(update, 300)();
                            }
                        });
                    } else {
                        input.value = value;
                        input.addEventListener('input', function() {
                            setNestedValue(currentVariableValues, this.name, this.value);
                            
                            // Sync to JSON editor
                            syncFormToJson();
                            
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
                    
                    // Sync to JSON editor
                    syncFormToJson();
                    
                    if (autoRerenderToggle.checked) {
                        debounce(update, 300)();
                    }
                });
                
                container.appendChild(textarea);
            }
            
        } else {
            // Handle primitive values with type selection
            const inputDiv = document.createElement('div');
            inputDiv.className = 'variable-input';
            
            // Create header with label and type selector
            const headerDiv = document.createElement('div');
            headerDiv.className = 'variable-header';
            
            const label = document.createElement('label');
            label.textContent = baseName;
            label.setAttribute('for', `var-${baseName}`);
            
            // Type selector dropdown
            const typeSelect = document.createElement('select');
            typeSelect.className = 'type-selector';
            
            const types = [
                { value: 'string', label: 'Text' },
                { value: 'number', label: 'Number' },
                { value: 'boolean', label: 'Boolean' },
                { value: 'json', label: 'JSON' }
            ];
            
            // Detect current type
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
            
            // Function to create appropriate input based on type
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
            
            // Add event listener for input changes
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
                            value = this.value; // Keep as string if invalid JSON
                        }
                    }
                    
                    currentVariableValues[baseName] = value;
                    
                    // Sync to JSON editor
                    syncFormToJson();
                    
                    if (autoRerenderToggle.checked) {
                        debounce(update, 300)();
                    }
                });
            }
            
            addInputListener(currentInput, currentType);
            
            // Type selector change handler
            typeSelect.addEventListener('change', function() {
                const newType = this.value;
                const oldInput = inputDiv.querySelector('input, textarea');
                let currentValue = currentVariableValues[baseName] || structure;
                
                // Convert value to new type
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
                
                // Create new input
                const newInput = createInputForType(newType, currentValue);
                addInputListener(newInput, newType);
                
                // Replace the input
                oldInput.parentNode.replaceChild(newInput, oldInput);
                
                // Update stored value
                currentVariableValues[baseName] = currentValue;
                
                // Sync to JSON editor
                syncFormToJson();
                
                if (autoRerenderToggle.checked) {
                    debounce(update, 300)();
                }
            });
            
            inputDiv.appendChild(currentInput);
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
        // Return the current state that's been maintained by the form inputs
        return currentVariableValues;
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
        
        // Apply extra whitespace removal if enabled
        let processedResult = result;
        if (removeExtraWhitespaceToggle.checked) {
            processedResult = removeExtraWhitespace(result);
        }
        
        // Store the result
        lastRenderedOutput = processedResult;
        
        // Set the main content based on mode
        if (isMermaidMode) {
            // Render as pure mermaid diagram
            outputElement.style.display = 'none';
            markdownOutputElement.style.display = 'block';
            await renderPureMermaid(processedResult);
        } else if (isMarkdownMode) {
            // Render as markdown
            outputElement.style.display = 'none';
            markdownOutputElement.style.display = 'block';
            await renderMarkdown(processedResult);
        } else {
            // Render as plain text
            outputElement.style.display = 'block';
            markdownOutputElement.style.display = 'none';
            
            if (showWhitespaceToggle.checked) {
                outputElement.innerHTML = renderWhitespace(processedResult);
            } else {
                outputElement.textContent = processedResult;
            }
            outputElement.className = processedResult.includes('Error:') ? 'error' : '';
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

// Sync form to JSON button
syncFormBtn.addEventListener('click', function() {
    if (isFormMode) {
        syncFormToJson();
        showButtonFeedback(this, 'Synced to JSON!', 1500);
    }
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
        syncFormBtn.style.display = 'inline-block';
        
        // Get current variables from JSON and update our state
        try {
            const currentVars = JSON.parse(varsEditor.getValue() || '{}');
            // Merge with existing values to preserve any form changes
            currentVariableValues = { ...currentVariableValues, ...currentVars };
            
            // Convert to the structure format expected by createVariableForm
            const variableStructures = {};
            Object.keys(currentVars).forEach(key => {
                variableStructures[key] = currentVars[key];
            });
            
            extractedVariables = new Set(Object.keys(currentVars));
        
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
        syncFormBtn.style.display = 'none';
        
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

// Remove extra whitespace toggle
removeExtraWhitespaceToggle.addEventListener('change', function() {
    update(); // Re-render the output with the new setting
    const message = this.checked ? 'Extra whitespace removed' : 'Extra whitespace kept';
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
        showButtonFeedback(this, 'Copied!', 1500);
    } catch (err) {
        // Fallback for older browsers
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
copyOutputBtn.addEventListener('click', async function() {
    try {
        const outputContent = outputElement.textContent;
        await navigator.clipboard.writeText(outputContent);
        showButtonFeedback(this, 'Copied!', 1500);
    } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = outputElement.textContent;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showButtonFeedback(this, 'Copied!', 1500);
    }
});

// --- DRAWER FUNCTIONALITY ---

/**
 * Opens the saved configurations drawer
 */
function openDrawer() {
    burgerMenuBtn.classList.add('active');
    drawerOverlay.classList.add('active');
    savedConfigsDrawer.classList.add('active');
    loadSavedConfigurations();
}

/**
 * Closes the saved configurations drawer
 */
function closeDrawer() {
    burgerMenuBtn.classList.remove('active');
    drawerOverlay.classList.remove('active');
    savedConfigsDrawer.classList.remove('active');
}

/**
 * Truncates text to a specified length
 */
function truncateText(text, maxLength = 100) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * Formats date for display
 */
function formatDate(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

/**
 * Creates a configuration card element
 */
function createConfigCard(config, index) {
    const card = document.createElement('div');
    card.className = 'config-card';
    
    // Header with name and date
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
        openRenameModal(index, config.name);
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
    
    // Add version info if available
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
    
    // Switch states section (if available)
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
        loadConfiguration(config);
        closeDrawer();
    });
    
    const shareBtn = document.createElement('button');
    shareBtn.className = 'config-action-btn share-btn';
    shareBtn.textContent = 'Share';
    shareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        shareConfiguration(config, shareBtn);
    });
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'config-action-btn delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteConfiguration(index);
    });
    
    actions.appendChild(loadBtn);
    actions.appendChild(shareBtn);
    actions.appendChild(deleteBtn);
    card.appendChild(actions);
    
    return card;
}

/**
 * Loads and displays all saved configurations in the drawer
 */
function loadSavedConfigurations() {
    try {
        const stored = localStorage.getItem('jinjaConfigurations');
        const configs = stored ? JSON.parse(stored) : [];
        
        // Clear existing content except empty message
        drawerContent.innerHTML = '';
        
        if (configs.length === 0) {
            drawerEmptyMessage.style.display = 'block';
            drawerContent.appendChild(drawerEmptyMessage);
        } else {
            drawerEmptyMessage.style.display = 'none';
            
            // Display configs in reverse order (newest first)
            const reversedConfigs = [...configs].reverse();
            reversedConfigs.forEach((config, index) => {
                const actualIndex = configs.length - 1 - index; // Get actual index in original array
                const card = createConfigCard(config, actualIndex);
                drawerContent.appendChild(card);
            });
        }
    } catch (e) {
        console.error('Error loading saved configurations:', e);
        drawerContent.innerHTML = '<p class="drawer-empty-message" style="color: #ef4444;">Error loading saved configurations.</p>';
    }
}

/**
 * Deletes a configuration by index
 */
function deleteConfiguration(index) {
    try {
        const stored = localStorage.getItem('jinjaConfigurations');
        let configs = stored ? JSON.parse(stored) : [];
        
        if (index >= 0 && index < configs.length) {
            configs.splice(index, 1);
            localStorage.setItem('jinjaConfigurations', JSON.stringify(configs));
            loadSavedConfigurations(); // Refresh the list
        }
    } catch (e) {
        console.error('Error deleting configuration:', e);
    }
}

/**
 * Opens the rename modal
 */
function openRenameModal(index, currentName) {
    currentRenameIndex = index;
    renameConfigNameInput.value = currentName;
    renameModalOverlay.classList.add('active');
    renameConfigNameInput.focus();
    renameConfigNameInput.select();
}

/**
 * Closes the rename modal
 */
function closeRenameModal() {
    currentRenameIndex = null;
    renameModalOverlay.classList.remove('active');
    renameConfigNameInput.value = '';
}

/**
 * Renames a configuration
 */
function renameConfiguration(overrideName = null) {
    const newName = overrideName || renameConfigNameInput.value.trim();
    
    if (!newName) {
        // Visual feedback for empty name
        renameConfigNameInput.style.borderColor = '#ef4444';
        renameConfigNameInput.placeholder = 'Please enter a name';
        setTimeout(() => {
            renameConfigNameInput.style.borderColor = '';
            renameConfigNameInput.placeholder = 'Enter new name';
        }, 2000);
        return;
    }
    
    try {
        const stored = localStorage.getItem('jinjaConfigurations');
        let configs = stored ? JSON.parse(stored) : [];
        
        if (currentRenameIndex >= 0 && currentRenameIndex < configs.length) {
            const oldName = configs[currentRenameIndex].name;
            
            // Check if the new name conflicts with an existing config (excluding the current one)
            const conflictIndex = configs.findIndex((c, idx) => c.name === newName && idx !== currentRenameIndex);
            if (conflictIndex !== -1 && !overrideName) {
                // Show conflict modal
                closeRenameModal();
                openConflictModal(newName, true);
                return;
            }
            
            configs[currentRenameIndex].name = newName;
            localStorage.setItem('jinjaConfigurations', JSON.stringify(configs));
            loadSavedConfigurations(); // Refresh the list
            closeRenameModal();
            closeConflictModal();
        }
    } catch (e) {
        console.error('Error renaming configuration:', e);
    }
}

/**
 * Shares a configuration by creating a compressed URL
 */
async function shareConfiguration(config, button) {
    try {
        // Create a clean config object for sharing (without timestamp for shorter URL)
        const shareConfig = {
            name: config.name,
            template: config.template,
            variables: config.variables,
            isFormMode: config.isFormMode,
            switchStates: config.switchStates
        };
        
        // Convert to JSON and compress
        const json = JSON.stringify(shareConfig);
        const compressed = LZString.compressToEncodedURIComponent(json);
        
        // Create share URL
        const baseUrl = window.location.origin + window.location.pathname;
        const shareUrl = `${baseUrl}?config=${compressed}`;
        
        // Copy to clipboard
        await navigator.clipboard.writeText(shareUrl);
        
        // Show feedback
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        button.style.background = getComputedStyle(document.documentElement).getPropertyValue('--success-color').trim();
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '';
        }, 2000);
        
        console.log('Share URL length:', shareUrl.length);
    } catch (err) {
        console.error('Error sharing configuration:', err);
        
        // Fallback for older browsers
        const originalText = button.textContent;
        button.textContent = 'Error!';
        button.style.background = '#ef4444';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '';
        }, 2000);
    }
}

/**
 * Shares the current configuration (without saving)
 */
async function shareCurrentConfiguration() {
    try {
        // Get current template and variables
        const template = jinjaEditor.getValue();
        const variables = getCurrentVariables();
        
        // Get all toggle/switch states
        const switchStates = {
            textWrap: textWrapToggle.checked,
            autoRerender: autoRerenderToggle.checked,
            showWhitespace: showWhitespaceToggle.checked,
            removeExtraWhitespace: removeExtraWhitespaceToggle.checked,
            markdown: markdownToggle.checked,
            mermaid: mermaidToggle.checked,
            theme: themeToggle.checked,
            jinjaVersion: jinjaVersionSelect.value
        };
        
        // Create config object for sharing
        const shareConfig = {
            name: "Shared Configuration",
            template: template,
            variables: variables,
            isFormMode: isFormMode,
            switchStates: switchStates
        };
        
        // Convert to JSON and compress
        const json = JSON.stringify(shareConfig);
        const compressed = LZString.compressToEncodedURIComponent(json);
        
        // Create share URL
        const baseUrl = window.location.origin + window.location.pathname;
        const shareUrl = `${baseUrl}?config=${compressed}`;
        
        // Copy to clipboard
        await navigator.clipboard.writeText(shareUrl);
        
        // Show feedback
        showButtonFeedback(shareCurrentBtn, 'URL Copied!', 2000);
        
        console.log('Share URL length:', shareUrl.length);
    } catch (err) {
        console.error('Error sharing current configuration:', err);
        
        // Show error feedback
        const originalText = shareCurrentBtn.textContent;
        shareCurrentBtn.textContent = 'Error!';
        shareCurrentBtn.style.background = '#ef4444';
        shareCurrentBtn.disabled = true;
        
        setTimeout(() => {
            shareCurrentBtn.textContent = originalText;
            shareCurrentBtn.style.background = '';
            shareCurrentBtn.disabled = false;
        }, 2000);
    }
}

/**
 * Loads configuration from URL parameter on page load
 */
function loadFromUrlParam() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const configParam = urlParams.get('config');
        
        if (configParam) {
            // Decompress the configuration
            const decompressed = LZString.decompressFromEncodedURIComponent(configParam);
            const config = JSON.parse(decompressed);
            
            // Load the configuration
            loadConfiguration(config);
            
            // Clean up the URL (remove the parameter)
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
            
            console.log('Loaded shared configuration:', config.name);
        }
    } catch (e) {
        console.error('Error loading configuration from URL:', e);
    }
}

// Burger menu button
burgerMenuBtn.addEventListener('click', function() {
    if (savedConfigsDrawer.classList.contains('active')) {
        closeDrawer();
    } else {
        openDrawer();
    }
});

// Drawer close button
drawerCloseBtn.addEventListener('click', function() {
    closeDrawer();
});

// Drawer overlay click
drawerOverlay.addEventListener('click', function() {
    closeDrawer();
});

// --- RENAME CONFIGURATION FUNCTIONALITY ---

// Rename modal close button
renameModalCloseBtn.addEventListener('click', function() {
    closeRenameModal();
});

// Rename modal cancel button
renameModalCancelBtn.addEventListener('click', function() {
    closeRenameModal();
});

// Rename modal save button
renameModalSaveBtn.addEventListener('click', function() {
    renameConfiguration();
});

// Close rename modal when clicking outside
renameModalOverlay.addEventListener('click', function(e) {
    if (e.target === renameModalOverlay) {
        closeRenameModal();
    }
});

// Handle Enter key in rename input
renameConfigNameInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        renameConfiguration();
    }
});

// --- SAVE CONFIGURATION FUNCTIONALITY ---

// Share current configuration button
shareCurrentBtn.addEventListener('click', function() {
    shareCurrentConfiguration();
});

/**
 * Generates a unique name by appending a number
 */
function generateUniqueName(baseName, existingNames) {
    let counter = 1;
    let newName = `${baseName} (${counter})`;
    while (existingNames.includes(newName)) {
        counter++;
        newName = `${baseName} (${counter})`;
    }
    return newName;
}

/**
 * Opens the conflict resolution modal
 */
function openConflictModal(conflictName, isRename = false) {
    const savedConfigs = JSON.parse(localStorage.getItem('jinjaConfigurations') || '[]');
    const existingNames = savedConfigs.map(c => c.name);
    const uniqueName = generateUniqueName(conflictName, existingNames);
    
    conflictNameDisplay.textContent = conflictName;
    conflictNewNameInput.value = uniqueName;
    conflictButtonName.textContent = uniqueName;
    
    conflictContext = {
        originalName: conflictName,
        uniqueName: uniqueName,
        isRename: isRename,
        existingNames: existingNames
    };
    
    // Initial validation
    validateConflictInput();
    
    conflictModalOverlay.classList.add('active');
    setTimeout(() => {
        conflictNewNameInput.focus();
        conflictNewNameInput.select();
    }, 100);
}

/**
 * Validates the conflict input and updates button states
 */
function validateConflictInput() {
    if (!conflictContext) return;
    
    const newName = conflictNewNameInput.value.trim();
    const { originalName, uniqueName, existingNames } = conflictContext;
    
    // Clear previous hints
    conflictInputHint.className = 'modal-input-hint';
    conflictInputHint.textContent = '';
    
    if (!newName) {
        // Empty input
        conflictSaveNewBtn.disabled = true;
        conflictOverrideBtn.disabled = false;
        conflictInputHint.className = 'modal-input-hint error';
        conflictInputHint.textContent = 'Please enter a name';
        return;
    }
    
    if (newName === originalName) {
        // Same as original (unchanged from conflict)
        conflictSaveNewBtn.disabled = true;
        conflictOverrideBtn.disabled = false;
        conflictInputHint.className = 'modal-input-hint info';
        conflictInputHint.textContent = 'This name already exists. Use "Override" to replace it.';
        return;
    }
    
    if (existingNames.includes(newName)) {
        // Name already exists (different from original)
        conflictSaveNewBtn.disabled = true;
        conflictOverrideBtn.disabled = false;
        conflictInputHint.className = 'modal-input-hint error';
        conflictInputHint.textContent = 'This name also already exists. Choose a different name.';
        return;
    }
    
    // Valid unique name
    conflictSaveNewBtn.disabled = false;
    conflictOverrideBtn.disabled = true;
    conflictButtonName.textContent = newName;
    conflictInputHint.className = 'modal-input-hint success';
    conflictInputHint.textContent = '✓ This name is available';
}

/**
 * Closes the conflict resolution modal
 */
function closeConflictModal() {
    conflictModalOverlay.classList.remove('active');
    conflictNewNameInput.value = '';
    conflictInputHint.textContent = '';
    conflictInputHint.className = 'modal-input-hint';
    conflictContext = null;
}

/**
 * Opens the save configuration modal
 */
function openSaveModal() {
    saveModalOverlay.classList.add('active');
    configNameInput.value = '';
    configNameInput.focus();
}

/**
 * Closes the save configuration modal
 */
function closeSaveModal() {
    saveModalOverlay.classList.remove('active');
    configNameInput.value = '';
}

/**
 * Saves the current configuration to local storage
 */
function saveConfiguration(overrideName = null) {
    const configName = overrideName || configNameInput.value.trim();
    
    if (!configName) {
        // Visual feedback for empty name
        configNameInput.style.borderColor = '#ef4444';
        configNameInput.placeholder = 'Please enter a name';
        setTimeout(() => {
            configNameInput.style.borderColor = '';
            configNameInput.placeholder = 'Enter a name for this configuration';
        }, 2000);
        return;
    }
    
    // Get existing saves from local storage
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
    
    // Check if a configuration with the same name exists (and we're not overriding)
    const existingIndex = savedConfigs.findIndex(c => c.name === configName);
    if (existingIndex !== -1 && !overrideName) {
        // Show conflict modal
        closeSaveModal();
        openConflictModal(configName, false);
        return;
    }
    
    // Get current template and variables
    const template = jinjaEditor.getValue();
    const variables = getCurrentVariables();
    
    // Get all toggle/switch states
    const switchStates = {
        textWrap: textWrapToggle.checked,
        autoRerender: autoRerenderToggle.checked,
        showWhitespace: showWhitespaceToggle.checked,
        removeExtraWhitespace: removeExtraWhitespaceToggle.checked,
        markdown: markdownToggle.checked,
        mermaid: mermaidToggle.checked,
        theme: themeToggle.checked, // light mode when checked
        jinjaVersion: jinjaVersionSelect.value
    };
    
    // Create configuration object
    const config = {
        name: configName,
        template: template,
        variables: variables,
        timestamp: new Date().toISOString(),
        isFormMode: isFormMode,
        switchStates: switchStates
    };
    
    // Check if a configuration with the same name exists
    const finalExistingIndex = savedConfigs.findIndex(c => c.name === configName);
    if (finalExistingIndex !== -1) {
        // Update existing configuration
        savedConfigs[finalExistingIndex] = config;
    } else {
        // Add new configuration
        savedConfigs.push(config);
    }
    
    // Save to local storage
    try {
        localStorage.setItem('jinjaConfigurations', JSON.stringify(savedConfigs));
        
        // Close modals
        closeSaveModal();
        closeConflictModal();
        
        // Refresh drawer if it's open
        if (savedConfigsDrawer.classList.contains('active')) {
            loadSavedConfigurations();
        }
        
        // Show success feedback
        showButtonFeedback(saveConfigBtn, 'Saved!', 2000);
    } catch (e) {
        console.error('Error saving configuration:', e);
        alert('Error saving configuration. Local storage might be full.');
    }
}

/**
 * Loads a saved configuration and restores all settings
 */
function loadConfiguration(config) {
    // Set template
    jinjaEditor.setValue(config.template || '');
    
    // Set variables
    if (config.isFormMode) {
        // Switch to form mode if needed
        if (!isFormMode) {
            toggleModeBtn.click();
        }
        currentVariableValues = config.variables || {};
        createVariableForm(config.variables || {});
    } else {
        // Switch to JSON mode if needed
        if (isFormMode) {
            toggleModeBtn.click();
        }
        varsEditor.setValue(JSON.stringify(config.variables || {}, null, 2));
    }
    
    // Restore switch states if they exist
    if (config.switchStates) {
        const states = config.switchStates;
        
        // Text wrap
        if (textWrapToggle.checked !== states.textWrap) {
            textWrapToggle.checked = states.textWrap;
            jinjaEditor.setOption('lineWrapping', states.textWrap);
            varsEditor.setOption('lineWrapping', states.textWrap);
        }
        
        // Auto rerender
        if (autoRerenderToggle.checked !== states.autoRerender) {
            autoRerenderToggle.checked = states.autoRerender;
            manualRerenderBtn.disabled = states.autoRerender;
            setupEventListeners();
        }
        
        // Show whitespace
        if (showWhitespaceToggle.checked !== states.showWhitespace) {
            showWhitespaceToggle.checked = states.showWhitespace;
        }
        
        // Remove extra whitespace (default to true if not present in old configs)
        const removeExtraState = states.removeExtraWhitespace !== undefined ? states.removeExtraWhitespace : true;
        if (removeExtraWhitespaceToggle.checked !== removeExtraState) {
            removeExtraWhitespaceToggle.checked = removeExtraState;
        }
        
        // Markdown mode
        if (markdownToggle.checked !== states.markdown) {
            markdownToggle.checked = states.markdown;
            isMarkdownMode = states.markdown;
            if (states.markdown) {
                outputElement.style.display = 'none';
                markdownOutputElement.style.display = 'block';
                showWhitespaceToggle.disabled = true;
                showWhitespaceToggle.parentElement.style.opacity = '0.5';
            } else {
                outputElement.style.display = 'block';
                markdownOutputElement.style.display = 'none';
                showWhitespaceToggle.disabled = false;
                showWhitespaceToggle.parentElement.style.opacity = '1';
            }
        }
        
        // Mermaid mode
        if (mermaidToggle.checked !== states.mermaid) {
            mermaidToggle.checked = states.mermaid;
            isMermaidMode = states.mermaid;
            if (states.mermaid) {
                outputElement.style.display = 'none';
                markdownOutputElement.style.display = 'block';
                showWhitespaceToggle.disabled = true;
                showWhitespaceToggle.parentElement.style.opacity = '0.5';
            } else {
                outputElement.style.display = 'block';
                markdownOutputElement.style.display = 'none';
                showWhitespaceToggle.disabled = false;
                showWhitespaceToggle.parentElement.style.opacity = '1';
            }
        }
        
        // Jinja2 version - just show it in the badge, don't auto-switch
        // User can manually switch if they want to test with that version
        
        // Theme (optional - you might want to keep theme as a global preference)
        // Uncomment if you want saved configs to restore theme as well
        /*
        if (themeToggle.checked !== states.theme) {
            themeToggle.checked = states.theme;
            themeToggle.dispatchEvent(new Event('change'));
        }
        */
    }
    
    // Trigger update to render with new values
    update();
}

// Save configuration button
saveConfigBtn.addEventListener('click', function() {
    openSaveModal();
});

// Modal close button
modalCloseBtn.addEventListener('click', function() {
    closeSaveModal();
});

// Modal cancel button
modalCancelBtn.addEventListener('click', function() {
    closeSaveModal();
});

// Modal save button
modalSaveBtn.addEventListener('click', function() {
    saveConfiguration();
});

// Close modal when clicking outside
saveModalOverlay.addEventListener('click', function(e) {
    if (e.target === saveModalOverlay) {
        closeSaveModal();
    }
});

// Handle Enter key in config name input
configNameInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        saveConfiguration();
    }
});

// Conflict modal event listeners
conflictModalCloseBtn.addEventListener('click', function() {
    closeConflictModal();
});

// Input validation on every keystroke
conflictNewNameInput.addEventListener('input', function() {
    validateConflictInput();
});

// Handle Enter key in conflict input
conflictNewNameInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !conflictSaveNewBtn.disabled) {
        conflictSaveNewBtn.click();
    }
});

conflictOverrideBtn.addEventListener('click', function() {
    if (!conflictContext) return;
    
    if (conflictContext.isRename) {
        // Override for rename
        renameConfiguration(conflictContext.originalName);
    } else {
        // Override for save
        saveConfiguration(conflictContext.originalName);
    }
});

conflictSaveNewBtn.addEventListener('click', function() {
    if (!conflictContext || this.disabled) return;
    
    const newName = conflictNewNameInput.value.trim();
    
    if (conflictContext.isRename) {
        // Save with new name for rename
        renameConfiguration(newName);
    } else {
        // Save with new name for save
        saveConfiguration(newName);
    }
});

// Close conflict modal when clicking outside
conflictModalOverlay.addEventListener('click', function(e) {
    if (e.target === conflictModalOverlay) {
        closeConflictModal();
    }
});

// Handle Escape key to close modal or drawer
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        if (conflictModalOverlay.classList.contains('active')) {
            closeConflictModal();
        } else if (saveModalOverlay.classList.contains('active')) {
            closeSaveModal();
        } else if (renameModalOverlay.classList.contains('active')) {
            closeRenameModal();
        } else if (savedConfigsDrawer.classList.contains('active')) {
            closeDrawer();
        }
    }
});

// Custom dropdown functionality
customSelectTrigger.addEventListener('click', function(e) {
    e.stopPropagation();
    customJinjaSelect.classList.toggle('open');
});

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
    if (!customJinjaSelect.contains(e.target)) {
        customJinjaSelect.classList.remove('open');
    }
});

// Handle option selection
versionOptions.querySelectorAll('.custom-option').forEach(option => {
    option.addEventListener('click', function() {
        const value = this.getAttribute('data-value');
        const text = this.textContent;
        
        // Update visual state
        versionOptions.querySelectorAll('.custom-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        this.classList.add('selected');
        
        // Update trigger text
        selectedVersionText.textContent = text;
        
        // Update hidden select and trigger change event
        jinjaVersionSelect.value = value;
        jinjaVersionSelect.dispatchEvent(new Event('change'));
        
        // Close dropdown
        customJinjaSelect.classList.remove('open');
    });
});

// Initialize first option as selected
versionOptions.querySelector('.custom-option[data-value="latest"]').classList.add('selected');

// Jinja2 version selector
jinjaVersionSelect.addEventListener('change', async function() {
    const selectedVersion = this.value;
    
    if (!isInitialized || selectedVersion === currentJinjaVersion) {
        return;
    }
    
    try {
        // Show loading state
        loader.textContent = `Switching to Jinja2 ${selectedVersion === 'latest' ? 'latest' : 'v' + selectedVersion}...`;
        loader.style.display = 'block';
        loadingOverlay.style.display = 'block';
        this.disabled = true;
        
        // Store the value to restore it after installation
        const versionToInstall = selectedVersion;
        
        // Install the new version
        await installJinja2Version(versionToInstall);
        
        // Ensure the select keeps its value
        this.value = versionToInstall;
        
        // Hide loading state
        loader.style.display = 'none';
        loadingOverlay.style.display = 'none';
        this.disabled = false;
        
        // Rerender with the new version
        await update();
        
    } catch (error) {
        loader.textContent = `Failed to switch Jinja2 version: ${error.message}`;
        loader.style.color = '#d32f2f';
        this.disabled = false;
        console.error('Version switch error:', error);
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
                curve: 'basis',
                wrap: true
            },
            themeVariables: {
                fontSize: '14px'
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
                curve: 'basis',
                wrap: true
            },
            themeVariables: {
                fontSize: '14px'
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