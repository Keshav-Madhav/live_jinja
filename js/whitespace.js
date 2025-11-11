/**
 * Whitespace handling functions
 */

/**
 * Renders text with visible whitespace characters without affecting layout
 */
export function renderWhitespace(text) {
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
 */
export function removeExtraWhitespace(text) {
    return text
        .replace(/^[ \t]+$/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/ {2,}/g, ' ')
        .replace(/\t{2,}/g, '\t')
        .replace(/\n[ \t]*\n[ \t]*\n/g, '\n\n');
}
