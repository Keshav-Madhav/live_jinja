import { state } from './state.js';
import { elements } from './dom.js';
import { jinjaEditor, varsEditor } from './editors.js';
import { parseJinjaError, formatErrorMessage, goToTemplateLine, clearTemplateError } from './error-handling.js';
import { renderWhitespace, removeExtraWhitespace } from './whitespace.js';
import { renderMarkdown, renderPureMermaid } from './markdown-renderer.js';

/**
 * Main rendering function
 */

export function getCurrentVariables() {
    if (state.isFormMode) {
        return state.currentVariableValues;
    } else {
        try {
            return JSON.parse(varsEditor.getValue() || '{}');
        } catch (e) {
            return {};
        }
    }
}

export async function update() {
    if (!state.pyodide || !state.isInitialized) {
        elements.outputElement.textContent = 'Python environment is still loading...';
        elements.outputElement.className = '';
        return;
    }

    const template = jinjaEditor.getValue();
    let context;

    try {
        context = getCurrentVariables();
    } catch (e) {
        const errorInfo = {
            line: null,
            column: null,
            message: e.message,
            fullError: e.stack || e.message,
            errorType: 'Variables Error'
        };
        
        const errorContainer = formatErrorMessage(errorInfo);
        elements.outputElement.innerHTML = '';
        elements.outputElement.appendChild(errorContainer);
        elements.outputElement.className = 'error';
        elements.outputElement.style.display = 'block';
        elements.markdownOutputElement.style.display = 'none';
        return;
    }

    try {
        const contextJson = JSON.stringify(context);
        
        const escapedTemplate = template.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
        const escapedContext = contextJson.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        
        const result = state.pyodide.runPython(`
import jinja2
import json
import traceback
import sys

try:
    template_str = """${escapedTemplate}"""
    context_str = """${escapedContext}"""
    
    template = jinja2.Template(template_str)
    context = json.loads(context_str)
    result = template.render(context)
except jinja2.exceptions.TemplateSyntaxError as e:
    result = f"TemplateSyntaxError: {e.message} (line {e.lineno})"
except jinja2.exceptions.UndefinedError as e:
    # Try to extract line number from traceback
    tb = sys.exc_info()[2]
    lineno = None
    for frame in traceback.extract_tb(tb):
        if 'template' in frame.filename.lower():
            lineno = frame.lineno
            break
    if lineno:
        result = f"UndefinedError: {str(e)} (line {lineno})"
    else:
        result = f"UndefinedError: {str(e)}"
except jinja2.exceptions.TemplateError as e:
    # Generic template error with line number if available
    lineno = getattr(e, 'lineno', None)
    if lineno:
        result = f"TemplateError: {str(e)} (line {lineno})"
    else:
        result = f"TemplateError: {str(e)}"
except json.JSONDecodeError as e:
    result = f"JSON Error: {str(e)} at line {e.lineno}, column {e.colno}"
except Exception as e:
    result = f"Error: {str(e)}"

result
        `);
        
        const isError = result.includes('Error:') || 
                       result.includes('TemplateSyntaxError:') ||
                       result.includes('UndefinedError:') ||
                       result.includes('TemplateError:');
        
        let processedResult = result;
        if (!isError && elements.removeExtraWhitespaceToggle.checked) {
            processedResult = removeExtraWhitespace(result);
        }
        
        state.lastRenderedOutput = processedResult;
        clearTemplateError();
        
        if (state.isMermaidMode) {
            elements.outputElement.style.display = 'none';
            elements.markdownOutputElement.style.display = 'block';
            await renderPureMermaid(processedResult);
        } else if (state.isMarkdownMode) {
            elements.outputElement.style.display = 'none';
            elements.markdownOutputElement.style.display = 'block';
            await renderMarkdown(processedResult);
        } else {
            elements.outputElement.style.display = 'block';
            elements.markdownOutputElement.style.display = 'none';
            
            if (isError) {
                const errorInfo = parseJinjaError(processedResult);
                const errorContainer = formatErrorMessage(errorInfo);
                
                elements.outputElement.innerHTML = '';
                elements.outputElement.appendChild(errorContainer);
                elements.outputElement.className = 'error';
                
                if (errorInfo.line !== null) {
                    setTimeout(() => {
                        goToTemplateLine(errorInfo.line, errorInfo.column, errorInfo.message);
                    }, 100);
                }
            } else {
                if (elements.showWhitespaceToggle.checked) {
                    elements.outputElement.innerHTML = renderWhitespace(processedResult);
                } else {
                    elements.outputElement.textContent = processedResult;
                }
                elements.outputElement.className = '';
            }
        }
    } catch (e) {
        const errorInfo = {
            line: null,
            column: null,
            message: e.message,
            fullError: e.stack || e.message,
            errorType: 'Python Execution Error'
        };
        
        const errorContainer = formatErrorMessage(errorInfo);
        elements.outputElement.innerHTML = '';
        elements.outputElement.appendChild(errorContainer);
        elements.outputElement.className = 'error';
        elements.outputElement.style.display = 'block';
        elements.markdownOutputElement.style.display = 'none';
    }
}
