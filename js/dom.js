// DOM element references
export const elements = {
    // Output elements
    outputElement: document.getElementById('output'),
    markdownOutputElement: document.getElementById('markdown-output'),
    loader: document.getElementById('loader'),
    loadingOverlay: document.getElementById('loading-overlay'),
    
    // Control elements
    textWrapToggle: document.getElementById('text-wrap-toggle'),
    autoRerenderToggle: document.getElementById('auto-rerender-toggle'),
    manualRerenderBtn: document.getElementById('manual-rerender'),
    extractVariablesBtn: document.getElementById('extract-variables-header'),
    toggleModeBtn: document.getElementById('toggle-mode'),
    syncFormBtn: document.getElementById('sync-form-btn'),
    variablesForm: document.getElementById('variables-form'),
    variablesHeader: document.getElementById('variables-header'),
    copyTemplateBtn: document.getElementById('copy-template-btn'),
    copyOutputBtn: document.getElementById('copy-output-btn'),
    showWhitespaceToggle: document.getElementById('show-whitespace-toggle'),
    removeExtraWhitespaceToggle: document.getElementById('remove-extra-whitespace-toggle'),
    themeToggle: document.getElementById('theme-toggle'),
    markdownToggle: document.getElementById('markdown-toggle'),
    mermaidToggle: document.getElementById('mermaid-toggle'),
    saveConfigBtn: document.getElementById('save-config-btn'),
    shareCurrentBtn: document.getElementById('share-current-btn'),
    
    // Modal elements
    saveModalOverlay: document.getElementById('save-modal-overlay'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    modalCancelBtn: document.getElementById('modal-cancel-btn'),
    modalSaveBtn: document.getElementById('modal-save-btn'),
    configNameInput: document.getElementById('config-name'),
    
    // Drawer elements
    burgerMenuBtn: document.getElementById('burger-menu-btn'),
    drawerOverlay: document.getElementById('drawer-overlay'),
    savedConfigsDrawer: document.getElementById('saved-configs-drawer'),
    drawerCloseBtn: document.getElementById('drawer-close-btn'),
    drawerContent: document.getElementById('drawer-content'),
    drawerEmptyMessage: document.getElementById('drawer-empty-message'),
    
    // Rename modal elements
    renameModalOverlay: document.getElementById('rename-modal-overlay'),
    renameModalCloseBtn: document.getElementById('rename-modal-close-btn'),
    renameModalCancelBtn: document.getElementById('rename-modal-cancel-btn'),
    renameModalSaveBtn: document.getElementById('rename-modal-save-btn'),
    renameConfigNameInput: document.getElementById('rename-config-name'),
    
    // Version selector elements
    jinjaVersionSelect: document.getElementById('jinja-version-select'),
    customJinjaSelect: document.getElementById('custom-jinja-select'),
    customSelectTrigger: document.getElementById('custom-jinja-select')?.querySelector('.custom-select-trigger'),
    selectedVersionText: document.getElementById('selected-version-text'),
    versionOptions: document.getElementById('version-options'),
    
    // Conflict modal elements
    conflictModalOverlay: document.getElementById('conflict-modal-overlay'),
    conflictModalCloseBtn: document.getElementById('conflict-modal-close-btn'),
    conflictOverrideBtn: document.getElementById('conflict-override-btn'),
    conflictSaveNewBtn: document.getElementById('conflict-save-new-btn'),
    conflictNameDisplay: document.getElementById('conflict-name-display'),
    conflictNewNameInput: document.getElementById('conflict-new-name-input'),
    conflictButtonName: document.getElementById('conflict-button-name'),
    conflictInputHint: document.getElementById('conflict-input-hint'),
    
    // Resize elements
    horizontalResize: document.getElementById('horizontal-resize'),
    verticalResize: document.getElementById('vertical-resize'),
    leftPanel: document.getElementById('left-panel'),
    rightPanel: document.getElementById('right-panel'),
    templatePane: document.getElementById('template-pane'),
    variablesPane: document.getElementById('variables-pane'),
    mainContainer: document.getElementById('main-container')
};
