import { jinjaEditor } from './editors.js';
import { state } from './state.js';

/**
 * Error handling and parsing functions
 */

/**
 * Parses Jinja2 error messages to extract line and column information
 */
export function parseJinjaError(errorText) {
    const errorInfo = {
        line: null,
        column: null,
        message: '',
        fullError: errorText,
        errorType: 'Unknown Error'
    };
    
    // Pattern 1: "line X" (most common in Jinja2 errors)
    const linePattern = /line (\d+)/i;
    const lineMatch = errorText.match(linePattern);
    if (lineMatch) {
        errorInfo.line = parseInt(lineMatch[1]);
    }
    
    // Pattern 2: "at line X, column Y" or "line X, column Y"
    const lineColPattern = /line (\d+)(?:,?\s+column (\d+))?/i;
    const lineColMatch = errorText.match(lineColPattern);
    if (lineColMatch) {
        errorInfo.line = parseInt(lineColMatch[1]);
        if (lineColMatch[2]) {
            errorInfo.column = parseInt(lineColMatch[2]);
        }
    }
    
    // Pattern 3: Extract error type
    const errorTypePattern = /jinja2\.exceptions\.(\w+):|(\w+Error):/i;
    const typeMatch = errorText.match(errorTypePattern);
    if (typeMatch) {
        errorInfo.errorType = typeMatch[1] || typeMatch[2];
    }
    
    // Pattern 4: Extract the actual error message (after the error type)
    const messagePattern = /(?:jinja2\.exceptions\.\w+:|[\w]+Error:)\s*(.+?)(?:\n|$)/i;
    const messageMatch = errorText.match(messagePattern);
    if (messageMatch) {
        errorInfo.message = messageMatch[1].trim();
    } else {
        // Fallback: use the first line that's not empty
        const lines = errorText.split('\n').filter(line => line.trim());
        errorInfo.message = lines[0] || errorText;
    }
    
    return errorInfo;
}

/**
 * Formats error message with enhanced styling
 */
export function formatErrorMessage(errorInfo) {
    const container = document.createElement('div');
    container.className = 'error-message-container';
    
    // Create error header
    const header = document.createElement('div');
    header.innerHTML = `<strong>❌ ${errorInfo.errorType}</strong>`;
    header.style.fontSize = '14px';
    header.style.marginBottom = '8px';
    container.appendChild(header);
    
    // Add location badge if we have line info
    if (errorInfo.line !== null) {
        const locationBadge = document.createElement('div');
        locationBadge.className = 'error-location';
        let locationText = `📍 Line ${errorInfo.line}`;
        if (errorInfo.column !== null) {
            locationText += `, Column ${errorInfo.column}`;
        }
        locationBadge.textContent = locationText;
        container.appendChild(locationBadge);
    }
    
    // Add error message
    const messageDiv = document.createElement('div');
    messageDiv.className = 'error-details';
    messageDiv.textContent = errorInfo.message;
    container.appendChild(messageDiv);
    
    return container;
}

/**
 * Navigates to and highlights a specific line in the template editor
 */
export function goToTemplateLine(line, column = null, errorMessage = '') {
    // Clear any existing error highlights
    clearTemplateError();
    
    // Convert to 0-indexed
    const lineIndex = Math.max(0, line - 1);
    const colIndex = column !== null ? Math.max(0, column - 1) : 0;
    
    // Only move cursor and scroll if user is NOT actively editing
    if (!state.isUserEditing) {
        // Move cursor to the error position
        const pos = { line: lineIndex, ch: colIndex };
        jinjaEditor.setCursor(pos);
        
        // Scroll to center the line
        jinjaEditor.scrollIntoView(pos, 100);
        
        // Focus the editor
        jinjaEditor.focus();
    }
    
    // Always highlight the error line (even if user is editing)
    state.currentErrorMark = jinjaEditor.markText(
        { line: lineIndex, ch: 0 },
        { line: lineIndex, ch: jinjaEditor.getLine(lineIndex).length },
        {
            className: 'cm-error-line',
            css: 'background-color: rgba(239, 68, 68, 0.2); border-left: 3px solid #ef4444;'
        }
    );
    
    // Add a widget with the actual error message
    const errorWidget = document.createElement('div');
    errorWidget.className = 'cm-error-widget';
    errorWidget.textContent = errorMessage || `⚠️ Error on line ${line}`;
    errorWidget.style.cssText = `
        color: #ef4444;
        font-size: 11px;
        font-weight: 600;
        padding: 4px 8px;
        margin-top: 2px;
        background: rgba(239, 68, 68, 0.1);
        border-radius: 4px;
        display: inline-block;
    `;
    
    state.currentErrorWidget = jinjaEditor.addLineWidget(lineIndex, errorWidget, {
        coverGutter: false,
        noHScroll: true
    });
    
    // Auto-clear highlight when user starts editing
    const clearOnChange = jinjaEditor.on('change', () => {
        clearTemplateError();
        jinjaEditor.off('change', clearOnChange);
    });
}

/**
 * Clears error highlighting from the template editor
 */
export function clearTemplateError() {
    if (state.currentErrorMark) {
        state.currentErrorMark.clear();
        state.currentErrorMark = null;
    }
    if (state.currentErrorWidget) {
        state.currentErrorWidget.clear();
        state.currentErrorWidget = null;
    }
}
