/**
 * Variable extraction and form generation
 */

/**
 * Extracts variable names and structures from a Jinja template
 */
export function extractVariablesFromTemplate(template) {
    const variableStructures = {};
    const referencedVariables = new Set();
    
    const jinjaKeywords = new Set([
        'if', 'elif', 'else', 'endif', 'for', 'endfor', 'while', 'endwhile',
        'set', 'endset', 'block', 'endblock', 'extends', 'include', 'import',
        'from', 'macro', 'endmacro', 'call', 'endcall', 'filter', 'endfilter',
        'with', 'endwith', 'autoescape', 'endautoescape', 'raw', 'endraw',
        'trans', 'endtrans', 'pluralize',
        'not', 'and', 'or', 'in', 'is', 'true', 'false', 'none', 'null',
        'True', 'False', 'None', 'NULL',
        'defined', 'undefined', 'none', 'boolean', 'false', 'true', 'integer',
        'float', 'number', 'string', 'sequence', 'iterable', 'mapping',
        'sameas', 'escaped', 'odd', 'even', 'divisibleby', 'equalto',
        'range', 'lipsum', 'dict', 'cycler', 'joiner', 'len', 'abs', 'round',
        'min', 'max', 'sum', 'list', 'tuple', 'set', 'sorted', 'reversed',
        'enumerate', 'zip', 'filter', 'map', 'any', 'all',
        'loop'
    ]);
    
    function isJinjaKeyword(varName) {
        return jinjaKeywords.has(varName.toLowerCase());
    }
    
    function extractVariablesFromExpression(expression) {
        const variables = [];
        
        let cleanedExpression = expression
            .replace(/'[^']*'/g, '')
            .replace(/"[^"]*"/g, '')
            .replace(/\b\d+\.?\d*\b/g, '')
            .replace(/\s+(?:and|or|not|in|is|==|!=|<=|>=|<|>)\s+/gi, ' ')
            .replace(/\s*[\(\)\[\]]\s*/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
            
        const functionCallPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*([^)]*)\s*\)/g;
        let funcMatch;
        while ((funcMatch = functionCallPattern.exec(expression)) !== null) {
            const funcName = funcMatch[1];
            const args = funcMatch[2];
            
            if (!isJinjaKeyword(funcName)) {
                variables.push(funcName);
            }
            
            if (args.trim()) {
                const argVariables = extractVariablesFromExpression(args);
                variables.push(...argVariables);
            }
        }
        
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
    
    function setNestedProperty(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current)) {
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

    function safeSetVariable(varName, newValue, allowOverride = false) {
        if (!(varName in variableStructures)) {
            variableStructures[varName] = newValue;
        } else if (allowOverride) {
            const existing = variableStructures[varName];
            const isExistingSimple = typeof existing === 'string' || typeof existing === 'boolean' || typeof existing === 'number';
            const isNewComplex = typeof newValue === 'object' && newValue !== null;
            
            if (isExistingSimple && isNewComplex) {
                variableStructures[varName] = newValue;
            }
        }
    }

    // Extract {% set %} patterns
    const setPattern = /\{\%\s*set\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*\%\}/g;
    let setMatch;
    
    while ((setMatch = setPattern.exec(template)) !== null) {
        const sourceVar = setMatch[2];
        const rootSourceVar = sourceVar.split('.')[0];
        
        if (isJinjaKeyword(rootSourceVar)) continue;
        
        referencedVariables.add(rootSourceVar);
        
        if (sourceVar.includes('.')) {
            safeSetVariable(rootSourceVar, {});
            setNestedProperty(variableStructures, sourceVar, '');
        } else {
            safeSetVariable(rootSourceVar, '');
        }
    }
    
    // Match {{ variable.property }} patterns
    const variablePattern = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)(?:\s*\|[^}]+)?\s*\}\}/g;
    let match;
    
    while ((match = variablePattern.exec(template)) !== null) {
        const fullPath = match[1];
        const rootVar = fullPath.split('.')[0];
        
        if (isJinjaKeyword(rootVar)) continue;
        
        referencedVariables.add(rootVar);
        
        if (fullPath.includes('.')) {
            safeSetVariable(rootVar, {}, true);
            setNestedProperty(variableStructures, fullPath, '');
        } else {
            safeSetVariable(rootVar, '');
        }
    }
    
    // Match {% for item in variable %} patterns
    const forPattern = /\{\%\s*for\s+\w+\s+in\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\%\}/g;
    while ((match = forPattern.exec(template)) !== null) {
        const varName = match[1];
        
        if (isJinjaKeyword(varName)) continue;
        
        referencedVariables.add(varName);
        
        if (!(varName in variableStructures)) {
            variableStructures[varName] = [''];
        } else if (!Array.isArray(variableStructures[varName]) && typeof variableStructures[varName] !== 'object') {
            variableStructures[varName] = [''];
        }
    }
    
    // Match {% for key, value in variable.items() %} patterns
    const dictForPattern = /\{\%\s*for\s+\w+,\s*\w+\s+in\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\.\s*items\s*\(\s*\)\s*\%\}/g;
    while ((match = dictForPattern.exec(template)) !== null) {
        const varName = match[1];
        
        if (isJinjaKeyword(varName)) continue;
        
        referencedVariables.add(varName);
        safeSetVariable(varName, { key1: 'value1', key2: 'value2' }, true);
    }
    
    // Match {% if ... %} and {% elif ... %} patterns
    const ifConditionPattern = /\{\%\s*(?:el)?if\s+([^%]+)\s*\%\}/g;
    while ((match = ifConditionPattern.exec(template)) !== null) {
        const condition = match[1];
        const variablesInCondition = extractVariablesFromExpression(condition);
        
        for (const fullPath of variablesInCondition) {
            const rootVar = fullPath.split('.')[0];
            referencedVariables.add(rootVar);
            
            if (fullPath.includes('.')) {
                safeSetVariable(rootVar, {}, true);
                setNestedProperty(variableStructures, fullPath, true);
            } else {
                if (!(rootVar in variableStructures)) {
                    variableStructures[rootVar] = true;
                }
            }
        }
    }
    
    // Match array access patterns
    const arrayAccessPattern = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*\[\s*(\d+)\s*\](?:\s*\|\s*[^}]+)?\s*\}\}/g;
    while ((match = arrayAccessPattern.exec(template)) !== null) {
        const basePath = match[1];
        const rootVar = basePath.split('.')[0];
        
        if (isJinjaKeyword(rootVar)) continue;
        
        referencedVariables.add(rootVar);
        safeSetVariable(rootVar, basePath.includes('.') ? {} : [], true);
        
        const arrayPath = basePath + '.' + match[2];
        setNestedProperty(variableStructures, arrayPath, '');
    }
    
    // Look for loop variables that access properties
    const loopWithPropertyPattern = /\{\%\s*for\s+(\w+)\s+in\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\%\}(.*?)\{\%\s*endfor\s*\%\}/gs;
    while ((match = loopWithPropertyPattern.exec(template)) !== null) {
        const loopVar = match[1];
        const arrayVar = match[2];
        const loopContent = match[3];
        
        if (isJinjaKeyword(arrayVar)) continue;
        
        referencedVariables.add(arrayVar);
        
        const loopVarPattern = new RegExp(`\\{\\{\\s*${loopVar}\\.([a-zA-Z_][a-zA-Z0-9_]*)`, 'g');
        let propMatch;
        const itemStructure = {};
        
        while ((propMatch = loopVarPattern.exec(loopContent)) !== null) {
            itemStructure[propMatch[1]] = '';
        }
        
        if (Object.keys(itemStructure).length > 0) {
            safeSetVariable(arrayVar, [itemStructure, itemStructure], true);
        }
    }
    
    const finalVariableStructures = {};
    for (const [varName, structure] of Object.entries(variableStructures)) {
        if (referencedVariables.has(varName)) {
            finalVariableStructures[varName] = structure;
        }
    }
    
    return finalVariableStructures;
}
