# Web Search Tool

The Web Search tool provides internet search capabilities using DuckDuckGo. It requires **no API key** and supports general web search, news search, and image search with configurable safe search levels.

## Quick Reference

| Property            | Value                                   |
| ------------------- | --------------------------------------- |
| **Node name**       | `tools/web-search`                      |
| **Version**         | 0.1.0                                   |
| **Library**         | duck-duck-scrape                        |
| **Actions**         | search, searchNews, searchImages        |
| **Required config** | None                                    |
| **Tags**            | search, web, duckduckgo, tools, agentic |

## Actions

### search

Perform a general web search.

| Parameter    | Type    | Required | Description                                                          |
| ------------ | ------- | -------- | -------------------------------------------------------------------- |
| `query`      | string  | Yes      | Search query (must not be empty)                                     |
| `maxResults` | integer | No       | Number of results to return (1--30, default: 5)                      |
| `region`     | string  | No       | Locale/region code (e.g. `en-us`)                                    |
| `safeSearch` | enum    | No       | Safe search level: `strict`, `moderate`, `off` (default: `moderate`) |
| `timeRange`  | enum    | No       | Time filter: `day`, `week`, `month`, `year`                          |

### searchNews

Search news articles.

| Parameter    | Type    | Required | Description                             |
| ------------ | ------- | -------- | --------------------------------------- |
| `query`      | string  | Yes      | Search query                            |
| `maxResults` | integer | No       | Number of results (1--30, default: 5)   |
| `region`     | string  | No       | Locale/region code                      |
| `safeSearch` | enum    | No       | Safe search level (default: `moderate`) |

### searchImages

Search for images.

| Parameter    | Type    | Required | Description                             |
| ------------ | ------- | -------- | --------------------------------------- |
| `query`      | string  | Yes      | Search query                            |
| `maxResults` | integer | No       | Number of results (1--30, default: 5)   |
| `region`     | string  | No       | Locale/region code                      |
| `safeSearch` | enum    | No       | Safe search level (default: `moderate`) |

## Output Schema

All actions return the same structure:

| Field         | Type    | Description                                    |
| ------------- | ------- | ---------------------------------------------- |
| `results`     | array   | Array of `{ title, url, description }` objects |
| `query`       | string  | The original query                             |
| `resultCount` | number  | Number of results returned                     |
| `success`     | boolean | Always `true` on success                       |

For `searchNews`, the `description` field contains the article excerpt. For `searchImages`, it contains the image source.

## Configuration Reference

| Property          | Type    | Default | Description                                                                                                                      |
| ----------------- | ------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `maxResultsLimit` | integer | `20`    | Maximum number of results allowed per query. The effective result count is `Math.min(input.maxResults, config.maxResultsLimit)`. |

## Safe Search Levels

| Level      | Behavior                             |
| ---------- | ------------------------------------ |
| `strict`   | Filter explicit content aggressively |
| `moderate` | Standard filtering (default)         |
| `off`      | No content filtering                 |

## Safety

The Web Search tool has a relatively small attack surface:

- **Result count cap**: The `maxResultsLimit` config prevents excessive result fetching regardless of what the input requests.
- **No API key required**: There are no credentials to leak or manage.
- **No outbound writes**: The tool only reads search results; it does not submit forms, post data, or modify anything.

## Usage Example

```typescript
import { webSearchNode } from '@flowforgejs/nodes';

const workflow = {
  nodes: [
    {
      id: 'research',
      node: webSearchNode,
      config: {
        maxResultsLimit: 10,
      },
      input: {
        action: 'search',
        query: 'FlowForge workflow automation',
        maxResults: 5,
        safeSearch: 'moderate',
      },
    },
  ],
};
```

!!! tip
Combine Web Search with [Web Scrape](web-scrape.md) for a full research pipeline: search for URLs, then scrape the top results for detailed content.
