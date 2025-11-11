import { state } from './state.js';
import { elements } from './dom.js';

/**
 * Markdown and Mermaid rendering functions
 */

/**
 * Renders markdown with Mermaid diagram support
 */
export async function renderMarkdown(text) {
    // Store the text for later use
    state.lastRenderedOutput = text;
    
    // Extract mermaid code blocks before markdown parsing
    const mermaidBlocks = [];
    const mermaidPlaceholder = text.replace(/```mermaid\n([\s\S]*?)```/g, (match, code) => {
        mermaidBlocks.push(code.trim());
        return `<div class="mermaid-placeholder" data-index="${mermaidBlocks.length - 1}"></div>`;
    });
    
    // Parse markdown
    const html = marked.parse(mermaidPlaceholder);
    
    // Insert HTML into the output element
    elements.markdownOutputElement.innerHTML = html;
    
    // Replace placeholders with actual mermaid diagrams
    const placeholders = elements.markdownOutputElement.querySelectorAll('.mermaid-placeholder');
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
export async function renderPureMermaid(text) {
    // Store the text for later use
    state.lastRenderedOutput = text;
    
    // Clear the markdown output and add a single mermaid diagram
    elements.markdownOutputElement.innerHTML = '';
    
    // Create a container for the mermaid diagram
    const mermaidDiv = document.createElement('div');
    mermaidDiv.className = 'mermaid';
    mermaidDiv.textContent = text.trim();
    
    elements.markdownOutputElement.appendChild(mermaidDiv);
    
    // Render the mermaid diagram
    try {
        await mermaid.run({
            querySelector: '.markdown-content .mermaid'
        });
    } catch (error) {
        console.error('Mermaid rendering error:', error);
        // Show error in a user-friendly way
        elements.markdownOutputElement.innerHTML = `<div style="color: #d32f2f; padding: 20px; border: 2px solid #d32f2f; border-radius: 8px; margin: 20px;">
            <strong>⚠️ Mermaid Rendering Error</strong><br><br>
            ${error.message || 'Failed to render diagram'}<br><br>
            <small>Please check your Mermaid syntax.</small>
        </div>`;
    }
}

/**
 * Initialize Mermaid with configuration
 */
export function initializeMermaid() {
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
}
