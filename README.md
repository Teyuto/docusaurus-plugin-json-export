# Docusaurus JSON Export Plugin

This plugin exports your Docusaurus content as JSON files, making it easy to use your content in other applications or static site generators. It provides flexible options for content export, including support for tags, authors, and pagination.

## Installation

```bash
npm install @teyuto/docusaurus-plugin-json-export
```


## Usage

Add the plugin to your `docusaurus.config.js`:

```javascript
module.exports = {
  // ... other config here
  plugins: [
    [
      '@teyuto/docusaurus-plugin-json-export',
      {
        exportPaths: ['blog'],
        outputDir: 'json',
        paginationSize: 9,
        sortBy: 'date',
        sortOrder: 'desc'
      }
    ],
  ],
};
```

## Options

- `exportPaths`: Array of paths to export (default: `['blog']`)
- `paginationSize`: Number of items per page for paginated lists (default: `10`)
- `includeDrafts`: Whether to include draft posts (default: `false`)
- `outputDir`: Directory to output JSON files (default: `'json-output'`)
- `minifyOutput`: Whether to minify the JSON output (default: `false`)
- `sortBy`: Field to sort by (default: `'date'`)
- `sortOrder`: Sort order, 'asc' or 'desc' (default: `'desc'`)
- `includeTagsList`: Whether to include a list of all tags (default: `true`)
- `includeAuthorsList`: Whether to include a list of all authors (default: `true`)
- `defaultImage`: Default image URL to use if not specified in frontmatter
- `excludedTags`: Array of tags to exclude from export
- `customFields`: Object of custom fields to include in each post
- `enablePagination`: Whether to create paginated list files (default: `true`)
- `defaultImagePath`: Base path for relative image URLs
- `excludeEmptyContent`: Whether to exclude posts with empty content (default: `true`)
- `authorFallback`: Fallback author object if not specified (default: `{ name: 'Unknown Author', title: 'Contributor' }`)

## Output

The plugin will generate JSON files in the specified output directory:

- Individual post files: `{outputDir}/{exportPath}/{slug}.json`
- Full list file: `{outputDir}/{exportPath}/list.json`
- Paginated list files: `{outputDir}/{exportPath}/list-{pageNumber}.json`
- Tags file: `{outputDir}/{exportPath}/tags.json`
- Authors file: `{outputDir}/{exportPath}/authors.json`

### Post JSON Structure

Each individual post JSON file will have the following structure:

```json
{
  "slug": "post-slug",
  "title": "Post Title",
  "seo_title": "SEO Title",
  "seo_description": "SEO Description",
  "date": "2023-09-20",
  "date_readable": "20 Sep 2023",
  "excerpt": "Post excerpt...",
  "image": "image-url",
  "tags": ["tag1", "tag2"],
  "prefix": 1,
  "author": {
    "name": "Author Name",
    "title": "Author Title",
    "url": "Author URL",
    "image_url": "Author Image URL"
  },
  "content": "HTML content...",
  "content_md": "Markdown content..."
}
```

### Tags JSON Structure

The `tags.json` file will have the following structure:

```json
[
  {
    "id": "tag1",
    "count": 5,
    "posts": [
      {
        "title": "Post Title",
        "slug": "post-slug"
      },
      // ... more posts
    ]
  },
  // ... more tags
]
```

### Authors JSON Structure

The `authors.json` file will have the following structure:

```json
[
  {
    "id": "author1",
    "name": "Author Name",
    "title": "Author Title",
    "url": "Author URL",
    "image_url": "Author Image URL",
    "count": 10,
    "posts": [
      {
        "title": "Post Title",
        "slug": "post-slug"
      },
      // ... more posts
    ]
  },
  // ... more authors
]
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.