import { commonEditorOptions, defaultTemplate, defaultVars } from './constants.js';

// Initialize CodeMirror editors
export const jinjaEditor = CodeMirror.fromTextArea(document.getElementById('jinja-template'), {
    ...commonEditorOptions,
    mode: 'jinja2',
});

export const varsEditor = CodeMirror.fromTextArea(document.getElementById('variables'), {
    ...commonEditorOptions,
    mode: { name: 'javascript', json: true },
});

// Set initial values
jinjaEditor.setValue(defaultTemplate);
varsEditor.setValue(JSON.stringify(defaultVars, null, 2));
