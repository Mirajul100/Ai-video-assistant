/**
 * Automatically detects when new content is added to the DOM 
 * and triggers MathJax to render any LaTeX formulas ($ or $$).
 */
let mathJaxTimeout = null;

const mathObserver = new MutationObserver((mutations) => {
  let shouldRender = false;
  
  // Check if any actual text or elements were added/changed
  for (const mutation of mutations) {
    if (mutation.addedNodes.length > 0 || mutation.type === 'characterData') {
      shouldRender = true;
      break;
    }
  }

  if (shouldRender) {
    // Debounce: Wait 300ms after the UI stops updating before rendering math.
    // This prevents browser lag when the AI is streaming text token-by-token.
    clearTimeout(mathJaxTimeout);
    mathJaxTimeout = setTimeout(() => {
      if (window.MathJax && window.MathJax.typesetPromise) {
        // Target specifically the main content area to save processing power
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
          window.MathJax.typesetPromise([mainContent]).catch((err) => {
            console.error('MathJax rendering error:', err.message);
          });
        }
      }
    }, 300); 
  }
});

// Start watching the page once it loads
document.addEventListener("DOMContentLoaded", () => {
  const targetNode = document.getElementById('main-content');
  if (targetNode) {
    // Watch for any child elements added, or text changes inside them
    mathObserver.observe(targetNode, { 
      childList: true, 
      subtree: true, 
      characterData: true 
    });
  }
});