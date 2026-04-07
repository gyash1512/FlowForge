# Web Scrape Tool

The Web Scrape tool fetches web pages and extracts content, links, or metadata using Cheerio. It enforces domain-level access controls and response size limits to prevent abuse.

## Quick Reference

| Property      | Value                                         |
| ------------- | --------------------------------------------- |
| **Node name** | `tools/web-scrape`                            |
| **Version**   | 0.1.0                                         |
| **Library**   | cheerio + native `fetch`                      |
| **Actions**   | fetch, extract, extractLinks, extractMetadata |
| **Tags**      | scrape, web, html, cheerio, tools, agentic    |

## Actions

### fetch

Fetch a web page, strip non-content elements (scripts, styles, nav, footer, header), and return the cleaned body text.

| Parameter   | Type                     | Required | Description                            |
| ----------- | ------------------------ | -------- | -------------------------------------- |
| `url`       | string                   | Yes      | URL to fetch (must be http or https)   |
| `headers`   | Record\<string, string\> | No       | Custom HTTP headers                    |
| `timeout`   | integer                  | No       | Request timeout in ms (default: 30000) |
| `userAgent` | string                   | No       | Custom User-Agent string               |

Returns `{ content }` -- the cleaned text content of the page body.

### extract

Extract specific elements from a page using a CSS selector.

| Parameter   | Type                     | Required | Description                            |
| ----------- | ------------------------ | -------- | -------------------------------------- |
| `url`       | string                   | Yes      | URL to fetch                           |
| `selector`  | string                   | Yes      | CSS selector to match elements         |
| `headers`   | Record\<string, string\> | No       | Custom HTTP headers                    |
| `timeout`   | integer                  | No       | Request timeout in ms (default: 30000) |
| `userAgent` | string                   | No       | Custom User-Agent string               |

Returns `{ elements }` -- an array of `{ text, html, attributes }` for each matched element.

### extractLinks

Extract all links from a page (excluding navigation, footer, and other non-content areas).

| Parameter | Type                     | Required | Description                            |
| --------- | ------------------------ | -------- | -------------------------------------- |
| `url`     | string                   | Yes      | URL to fetch                           |
| `headers` | Record\<string, string\> | No       | Custom HTTP headers                    |
| `timeout` | integer                  | No       | Request timeout in ms (default: 30000) |

Returns `{ links }` -- an array of `{ text, url }` objects with absolute URLs.

### extractMetadata

Extract page metadata: title, meta description, Open Graph tags, and canonical URL.

| Parameter | Type                     | Required | Description                            |
| --------- | ------------------------ | -------- | -------------------------------------- |
| `url`     | string                   | Yes      | URL to fetch                           |
| `headers` | Record\<string, string\> | No       | Custom HTTP headers                    |
| `timeout` | integer                  | No       | Request timeout in ms (default: 30000) |

Returns `{ title, metaDescription, ogTitle, ogDescription, ogImage, canonical }`.

## Output Schema

| Field     | Type    | Description                 |
| --------- | ------- | --------------------------- |
| `data`    | object  | Action-specific result data |
| `url`     | string  | The URL that was fetched    |
| `success` | boolean | `true` on success           |

## Configuration Reference

| Property          | Type     | Default          | Description                                                              |
| ----------------- | -------- | ---------------- | ------------------------------------------------------------------------ |
| `allowedDomains`  | string[] | (none)           | If set, only these domains (and their subdomains) can be fetched.        |
| `blockedDomains`  | string[] | `[]`             | Domains that are always blocked, even if they match `allowedDomains`.    |
| `maxResponseSize` | integer  | `5000000` (5 MB) | Maximum response size in bytes. Responses larger than this are rejected. |

## Safety

### Domain restrictions

The tool supports both allowlisting and blocklisting of domains:

- **allowedDomains**: When configured, only URLs whose hostname matches (or is a subdomain of) an allowed domain are fetched. All other domains are rejected.
- **blockedDomains**: Always checked, even when `allowedDomains` is not set. A hostname matching a blocked domain is rejected immediately.

Domain matching supports subdomains: if `example.com` is in the allow list, then `api.example.com` and `docs.example.com` are also allowed.

### Protocol validation

Only `http:` and `https:` protocols are permitted. Attempts to use `file:`, `ftp:`, `data:`, or other protocols are rejected with an explicit error.

### Response size limits

Before reading the response body, the tool checks the `Content-Length` header against `maxResponseSize`. Responses exceeding the limit are rejected.

### User-Agent

A default User-Agent (`FlowForge-Bot/1.0`) is sent with every request. This can be overridden via the `userAgent` input parameter.

!!! warning
The `maxResponseSize` check relies on the `Content-Length` header. If the server does not send this header, the response body is read in full. For untrusted URLs, combine this with `allowedDomains` to limit exposure.

## Usage Example

```typescript
import { webScrapeNode } from '@flowforgejs/nodes';

const workflow = {
  nodes: [
    {
      id: 'scrape-article',
      node: webScrapeNode,
      config: {
        allowedDomains: ['example.com', 'docs.example.com'],
        blockedDomains: ['ads.example.com'],
        maxResponseSize: 2_000_000,
      },
      input: {
        action: 'fetch',
        url: 'https://docs.example.com/guides/getting-started',
        timeout: 15_000,
      },
    },
  ],
};
```

!!! tip
Use `extractMetadata` to quickly preview a page's title and description before deciding whether to perform a full `fetch`. This is useful for filtering search results in a pipeline.
