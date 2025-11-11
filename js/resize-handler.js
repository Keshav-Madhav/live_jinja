import { state } from './state.js';
import { elements } from './dom.js';
import { jinjaEditor, varsEditor } from './editors.js';

/**
 * Panel resize functionality
 */

export function initializeResize() {
    setInitialSizes();
    
    elements.horizontalResize.addEventListener('mousedown', handleHorizontalResizeStart);
    elements.verticalResize.addEventListener('mousedown', handleVerticalResizeStart);
    
    window.addEventListener('resize', handleWindowResize);
}

function setInitialSizes() {
    elements.leftPanel.style.width = `${state.leftPanelWidth}%`;
    elements.rightPanel.style.width = `${100 - state.leftPanelWidth}%`;
    
    elements.templatePane.style.height = `${state.templatePaneHeight}%`;
    elements.variablesPane.style.height = `${100 - state.templatePaneHeight}%`;
}

function handleHorizontalResizeStart(e) {
    state.isResizing = true;
    state.resizeType = 'horizontal';
    state.startY = e.clientY;
    
    const templateRect = elements.templatePane.getBoundingClientRect();
    state.startHeight = templateRect.height;
    
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
    e.preventDefault();
}

function handleVerticalResizeStart(e) {
    state.isResizing = true;
    state.resizeType = 'vertical';
    state.startX = e.clientX;
    
    const leftRect = elements.leftPanel.getBoundingClientRect();
    state.startWidth = leftRect.width;
    
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
    e.preventDefault();
}

function handleResize(e) {
    if (!state.isResizing) return;
    
    if (state.resizeType === 'horizontal') {
        const deltaY = e.clientY - state.startY;
        const leftPanelRect = elements.leftPanel.getBoundingClientRect();
        const newTemplateHeight = state.startHeight + deltaY;
        const minHeight = 100;
        const maxHeight = leftPanelRect.height - minHeight - 4;
        
        if (newTemplateHeight >= minHeight && newTemplateHeight <= maxHeight) {
            const templatePercentage = (newTemplateHeight / leftPanelRect.height) * 100;
            const variablesPercentage = 100 - templatePercentage;
            
            elements.templatePane.style.height = `${templatePercentage}%`;
            elements.variablesPane.style.height = `${variablesPercentage}%`;
            state.templatePaneHeight = templatePercentage;
        }
    } else if (state.resizeType === 'vertical') {
        const deltaX = e.clientX - state.startX;
        const containerRect = elements.mainContainer.getBoundingClientRect();
        const newLeftWidth = state.startWidth + deltaX;
        const minWidth = 200;
        const maxWidth = containerRect.width - minWidth - 4;
        
        if (newLeftWidth >= minWidth && newLeftWidth <= maxWidth) {
            const leftPercentage = (newLeftWidth / containerRect.width) * 100;
            const rightPercentage = 100 - leftPercentage;
            
            elements.leftPanel.style.width = `${leftPercentage}%`;
            elements.rightPanel.style.width = `${rightPercentage}%`;
            state.leftPanelWidth = leftPercentage;
        }
    }
    
    setTimeout(() => {
        jinjaEditor.refresh();
        varsEditor.refresh();
    }, 10);
}

function stopResize() {
    state.isResizing = false;
    state.resizeType = null;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
}

function handleWindowResize() {
    setTimeout(() => {
        jinjaEditor.refresh();
        varsEditor.refresh();
    }, 100);
}
