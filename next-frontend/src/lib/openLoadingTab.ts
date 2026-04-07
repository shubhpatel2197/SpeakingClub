/**
 * Opens a new tab with a styled loading page instead of about:blank.
 * Returns the Window reference (or null if blocked).
 */
export function openLoadingTab(message = "Loading..."): Window | null {
  const tab = window.open("", "_blank");
  if (!tab) return null;

  tab.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${message}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #09090b;
      color: #a1a1aa;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #27272a;
      border-top-color: #a78bfa;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    .text {
      font-size: 15px;
      letter-spacing: 0.01em;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <p class="text">${message}</p>
  </div>
</body>
</html>`);
  tab.document.close();

  return tab;
}
