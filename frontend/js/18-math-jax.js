/**
 * Prepares dynamically rendered text for MathJax and serializes page typesetting.
 */
let mathJaxTimeout = null;
let isTypesettingMath = false;
let mathJaxRenderRequested = false;

function isEscapedMathCharacter(text, index) {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

function countMathDelimiters(text, target) {
  let count = 0;
  for (let cursor = 0; cursor < text.length;) {
    if (!isEscapedMathCharacter(text, cursor) && text.startsWith(target, cursor) &&
        (target !== "$" || (text[cursor - 1] !== "$" && text[cursor + 1] !== "$"))) {
      count += 1;
      cursor += target.length;
    } else {
      cursor += 1;
    }
  }
  return count;
}

function preprocessMathJaxText(text) {
  const parts = String(text).split(/(\r?\n)/);
  let delimiter = null;
  let discardOrphanCloser = null;
  let mathSource = "";
  let inCodeFence = false;
  let result = "";

  for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
    let part = parts[partIndex];
    if (partIndex % 2 === 1) {
      result += part;
      continue;
    }

    if (/^\s{0,3}```/.test(part)) {
      inCodeFence = !inCodeFence;
      result += part;
      continue;
    }
    if (inCodeFence) {
      result += part;
      continue;
    }

    if (delimiter && /^ {0,3}#{1,6}(?:\s|$)/.test(part)) {
      const remainingText = parts.slice(partIndex).join("");
      if (countMathDelimiters(remainingText, delimiter.close) % 2 === 1) {
        discardOrphanCloser = delimiter.close;
      }
      const lineBreak = parts[partIndex - 1] || "";
      result = result.slice(0, result.length - lineBreak.length) + delimiter.close + lineBreak;
      delimiter = null;
      mathSource = "";
    }

    let cursor = 0;
    while (cursor < part.length) {
      if (delimiter) {
        if (part.startsWith(delimiter.close, cursor) && !isEscapedMathCharacter(part, cursor)) {
          result += delimiter.close;
          cursor += delimiter.close.length;
          delimiter = null;
          mathSource = "";
          continue;
        }

        const character = part[cursor];
        const macroDefinition = /\\(?:newcommand|renewcommand|providecommand|def|gdef|edef|xdef)\b/.test(mathSource);
        if (character === "#" && !isEscapedMathCharacter(part, cursor) &&
            !(macroDefinition && /\d/.test(part[cursor + 1] || ""))) {
          result += "\\#";
        } else {
          result += character;
        }
        mathSource += character;
        cursor += 1;
        continue;
      }

      if (isEscapedMathCharacter(part, cursor)) {
        result += part[cursor];
        cursor += 1;
        continue;
      }

      if (discardOrphanCloser && part.startsWith(discardOrphanCloser, cursor) &&
          (discardOrphanCloser !== "$" || (part[cursor - 1] !== "$" && part[cursor + 1] !== "$"))) {
        cursor += discardOrphanCloser.length;
        discardOrphanCloser = null;
        continue;
      }

      const environmentMatch = part.slice(cursor).match(
        /^\\begin\{(equation\*?|align\*?|flalign\*?|gather\*?|multline\*?|alignat\*?|xalignat\*?|xxalignat\*?|displaymath)\}/
      );
      const opener = environmentMatch
        ? { open: environmentMatch[0], close: `\\end{${environmentMatch[1]}}` }
        : part.startsWith("$$", cursor)
          ? { open: "$$", close: "$$" }
          : part.startsWith("\\(", cursor)
            ? { open: "\\(", close: "\\)" }
            : part.startsWith("\\[", cursor)
              ? { open: "\\[", close: "\\]" }
              : part[cursor] === "$"
                ? { open: "$", close: "$" }
                : null;

      if (opener) {
        delimiter = opener;
        mathSource = "";
        result += opener.open;
        cursor += opener.open.length;
      } else {
        result += part[cursor];
        cursor += 1;
      }
    }
  }

  return result;
}

function preprocessMathJaxContent(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node;

  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (parent && parent.closest("mjx-container, .MathJax, script, style, code, pre, textarea")) {
      continue;
    }
    textNodes.push(node);
  }

  textNodes.forEach((textNode) => {
    const originalText = textNode.nodeValue;
    const processedText = preprocessMathJaxText(originalText);
    if (processedText !== originalText) textNode.nodeValue = processedText;
  });
}

function observeMathContent(root) {
  mathObserver.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function queueMathJaxTypeset() {
  mathJaxRenderRequested = true;
  clearTimeout(mathJaxTimeout);
  mathJaxTimeout = setTimeout(typesetMainContent, 300);
}

function typesetMainContent() {
  if (isTypesettingMath || !mathJaxRenderRequested) return;

  const mathJax = window.MathJax;
  const mainContent = document.getElementById("main-content");
  if (!mathJax || typeof mathJax.typesetPromise !== "function" || !mainContent) return;

  mathJaxRenderRequested = false;
  isTypesettingMath = true;
  mathObserver.disconnect();
  try {
    preprocessMathJaxContent(mainContent);
  } catch (error) {
    isTypesettingMath = false;
    console.error("MathJax content preprocessing failed:", error);
    observeMathContent(mainContent);
    return;
  }
  observeMathContent(mainContent);

  let typesetPromise;
  try {
    typesetPromise = mathJax.typesetPromise([mainContent]);
  } catch (error) {
    isTypesettingMath = false;
    console.error("MathJax rendering error:", error);
    if (mathJaxRenderRequested) queueMathJaxTypeset();
    return;
  }

  Promise.resolve(typesetPromise)
    .catch((error) => {
      console.error("MathJax rendering error:", error);
    })
    .finally(() => {
      isTypesettingMath = false;
      if (mathJaxRenderRequested) queueMathJaxTypeset();
    });
}

function isMathJaxOutputMutation(mutation) {
  const target = mutation.target instanceof Element
    ? mutation.target
    : mutation.target.parentElement;
  if (target && target.closest("mjx-container, .MathJax")) return true;

  return Array.from(mutation.addedNodes).some((addedNode) =>
    addedNode instanceof Element &&
    (addedNode.matches("mjx-container, .MathJax") || addedNode.querySelector("mjx-container, .MathJax"))
  );
}

const mathObserver = new MutationObserver((mutations) => {
  if (mutations.some((mutation) => !isMathJaxOutputMutation(mutation))) {
    queueMathJaxTypeset();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const mainContent = document.getElementById("main-content");
  const mathJaxScript = document.getElementById("MathJax-script");

  if (mainContent) {
    observeMathContent(mainContent);
    queueMathJaxTypeset();
  }

  if (mathJaxScript && typeof window.MathJax?.typesetPromise !== "function") {
    mathJaxScript.addEventListener("load", queueMathJaxTypeset, { once: true });
    mathJaxScript.addEventListener("error", () => {
      console.error("MathJax failed to load; mathematical content could not be rendered.");
    }, { once: true });
  }
});
