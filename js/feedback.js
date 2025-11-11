/**
 * User feedback functions
 */

/**
 * Provides visual feedback for button clicks
 */
export function showButtonFeedback(button, message = 'Done!', duration = 1500) {
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
export function showToggleFeedback(toggleElement, message) {
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
