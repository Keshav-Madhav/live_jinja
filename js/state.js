// Application state
export const state = {
    // Pyodide state
    pyodide: null,
    isInitialized: false,
    currentJinjaVersion: 'latest',
    
    // Editor state
    isUserEditing: false,
    currentErrorMark: null,
    currentErrorWidget: null,
    
    // Variable state
    isFormMode: false,
    extractedVariables: new Set(),
    currentVariableValues: {},
    
    // Render mode state
    isMarkdownMode: false,
    isMermaidMode: false,
    lastRenderedOutput: '',
    
    // Modal state
    currentRenameIndex: null,
    conflictContext: null,
    
    // Debounced functions
    debouncedUpdateFromJinja: null,
    debouncedUpdateFromVars: null,
    
    // Resize state
    isResizing: false,
    resizeType: null,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    leftPanelWidth: 50,
    templatePaneHeight: 60,
    
    // Timeout references
    editingTimeout: null
};
