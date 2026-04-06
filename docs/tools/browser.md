# Browser Tool

The Browser tool automates a web browser via Puppeteer, enabling navigation, screenshots, clicking, typing, JavaScript evaluation, text extraction, and PDF generation. It connects to an **existing browser instance** via WebSocket -- puppeteer-core does not bundle a browser binary.

## Quick Reference

| Property            | Value                                                         |
| ------------------- | ------------------------------------------------------------- |
| **Node name**       | `tools/browser`                                               |
| **Version**         | 0.1.0                                                         |
| **Library**         | puppeteer-core                                                |
| **Actions**         | navigate, screenshot, click, type, evaluate, extractText, pdf |
| **Required config** | `browserWSEndpoint`                                           |
| **Tags**            | browser, puppeteer, automation, scraping, tools, agentic      |

## Actions

### navigate

Navigate to a URL and wait for the page to load.

| Parameter         | Type   | Required | Description                               |
| ----------------- | ------ | -------- | ----------------------------------------- |
| `url`             | string | Yes      | URL to navigate to (http/https only)      |
| `waitForSelector` | string | No       | CSS selector to wait for after navigation |

Returns `{ title, url }` -- the page title and final URL (after any redirects).

### screenshot

Capture a screenshot of the current page.

| Parameter         | Type    | Required | Description                                        |
| ----------------- | ------- | -------- | -------------------------------------------------- |
| `fullPage`        | boolean | No       | Capture the full scrollable page (default: `true`) |
| `waitForSelector` | string  | No       | Wait for this selector before capturing            |

Returns `{ image }` -- the screenshot as a base64-encoded string.

### click

Click an element on the page.

| Parameter         | Type   | Required | Description                            |
| ----------------- | ------ | -------- | -------------------------------------- |
| `selector`        | string | Yes      | CSS selector of the element to click   |
| `waitForSelector` | string | No       | Wait for this selector before clicking |

### type

Type text into an input element.

| Parameter         | Type   | Required | Description                          |
| ----------------- | ------ | -------- | ------------------------------------ |
| `selector`        | string | Yes      | CSS selector of the input element    |
| `text`            | string | Yes      | Text to type                         |
| `waitForSelector` | string | No       | Wait for this selector before typing |

### evaluate

Execute arbitrary JavaScript in the page context.

| Parameter         | Type   | Required | Description                              |
| ----------------- | ------ | -------- | ---------------------------------------- |
| `script`          | string | Yes      | JavaScript code to evaluate              |
| `waitForSelector` | string | No       | Wait for this selector before evaluating |

Returns `{ result }` -- the return value of the evaluated expression.

### extractText

Extract all visible text from the page body.

| Parameter         | Type   | Required | Description                              |
| ----------------- | ------ | -------- | ---------------------------------------- |
| `waitForSelector` | string | No       | Wait for this selector before extracting |

Returns `{ text }` -- the `document.body.innerText` content.

### pdf

Generate a PDF of the current page (A4 format).

| Parameter         | Type   | Required | Description                              |
| ----------------- | ------ | -------- | ---------------------------------------- |
| `waitForSelector` | string | No       | Wait for this selector before generating |

Returns `{ pdf }` -- the PDF as a base64-encoded string.

## Output Schema

| Field     | Type    | Description                 |
| --------- | ------- | --------------------------- |
| `data`    | object  | Action-specific result data |
| `success` | boolean | `true` on success           |

## Configuration Reference

| Property            | Type     | Default       | Description                                                    |
| ------------------- | -------- | ------------- | -------------------------------------------------------------- |
| `browserWSEndpoint` | string   | -- (required) | WebSocket endpoint to connect to an existing browser instance. |
| `allowedDomains`    | string[] | (none)        | If set, only these domains (and subdomains) may be visited.    |
| `headless`          | boolean  | `true`        | Whether the browser runs in headless mode.                     |
| `timeout`           | integer  | `30000`       | Default timeout for all operations in milliseconds.            |

## Safety

### No bundled browser

The tool uses `puppeteer-core`, which does **not** include a Chromium binary. You must provide a `browserWSEndpoint` pointing to an already-running browser instance. This is an intentional security decision -- it prevents the tool from spawning browser processes on the host and gives operators full control over browser lifecycle and configuration.

Common browser providers:

- **Browserless** -- `ws://browserless:3000`
- **Chrome DevTools Protocol** -- `ws://localhost:9222/devtools/browser/<id>`
- **Playwright Server** -- compatible WebSocket endpoints

### Domain restrictions

When `allowedDomains` is configured, every URL (including navigation targets) is validated. The hostname must match or be a subdomain of an allowed domain. Rejected URLs throw an error before any browser interaction occurs.

### Protocol validation

Only `http:` and `https:` protocols are allowed. Attempts to navigate to `file:`, `javascript:`, `data:`, or other protocols are blocked.

### Page cleanup

Every action opens a new page and closes it in a `finally` block, ensuring resources are released even on error.

!!! warning
The `evaluate` action executes arbitrary JavaScript in the page context. When used with AI agents, ensure the agent cannot be prompt-injected into running malicious scripts. Pair with `allowedDomains` to limit the blast radius.

## Usage Example

```typescript
import { browserNode } from '@flowforge/nodes';

const workflow = {
  nodes: [
    {
      id: 'take-screenshot',
      node: browserNode,
      config: {
        browserWSEndpoint: 'ws://browserless:3000',
        allowedDomains: ['example.com'],
        timeout: 15_000,
      },
      input: {
        action: 'navigate',
        url: 'https://example.com/dashboard',
        waitForSelector: '.dashboard-loaded',
      },
    },
    {
      id: 'capture',
      node: browserNode,
      config: {
        browserWSEndpoint: 'ws://browserless:3000',
        allowedDomains: ['example.com'],
        timeout: 15_000,
      },
      input: {
        action: 'screenshot',
        fullPage: true,
      },
    },
  ],
};
```

!!! tip
Use `waitForSelector` to avoid capturing screenshots or extracting text before dynamic content has loaded. This is especially important for single-page applications that render client-side.
