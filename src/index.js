const path = require('path');
const fs = require('fs').promises;
const yaml = require('js-yaml');

function parseFrontMatter(content) {
  const frontMatterRegex = /---\s*([\s\S]*?)\s*---/;
  const match = content.match(frontMatterRegex);
  if (!match) return { frontMatter: {}, content };

  const frontMatterString = match[1];
  const frontMatter = {};
  frontMatterString.split('\n').forEach(line => {
    const [key, ...value] = line.split(':');
    if (key && value.length) {
      const trimmedKey = key.trim();
      let trimmedValue = value.join(':').trim();
      
      trimmedValue = trimmedValue.replace(/^["'](.*)["']$/, '$1');

      if (trimmedKey === 'tags') {
        try {
          frontMatter[trimmedKey] = JSON.parse(trimmedValue).map(tag => tag.replace(/^["'](.*)["']$/, '$1'));
        } catch (e) {
          console.error(`Error parsing tags: ${trimmedValue}`);
          frontMatter[trimmedKey] = [];
        }
      } else {
        frontMatter[trimmedKey] = trimmedValue;
      }
    }
  });

  return { frontMatter, content: content.replace(frontMatterRegex, '').trim() };
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
}

function formatDate2(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

function removeNumberPrefix(str) {
  return str.replace(/^\d+[-_]/, '');
}

function getNumberPrefix(str) {
  const match = str.match(/^(\d+)[-_]/);
  return match ? parseInt(match[1], 10) : null;
}

function replaceRelativeImagePaths(content, defaultImagePath) {
  if (!defaultImagePath) return content;
  return content.replace(/!\[.*?\]\((\/[^)]+)\)/g, (match, p1) => {
    if (!p1.startsWith('https://')) {
      return match.replace(p1, `${defaultImagePath}${p1}`);
    }
    return match;
  });
}

async function extractHtmlContent(htmlFilePath, defaultImagePath) {
  const htmlContent = await fs.readFile(htmlFilePath, 'utf8');
  const articleRegex = /<div id="__blog-post-container" class="markdown">([\s\S]*?)<\/div>/i;
  const match = htmlContent.match(articleRegex);
  let content = match ? match[1].trim() : '';

  if (defaultImagePath) {
    content = content.replace(/src="(\/[^"]+)"/g, (match, p1) => {
      if (!p1.startsWith('https://')) {
        return `src="${defaultImagePath}${p1}"`;
      }
      return match;
    });
  }

  return content;
}

async function findHtmlFile(buildDir, slug) {
  const possiblePaths = [
    path.join(buildDir, slug, 'index.html'),
    path.join(buildDir, removeNumberPrefix(slug), 'index.html'),
    path.join(buildDir, `${slug}.html`),
    path.join(buildDir, `${removeNumberPrefix(slug)}.html`),
  ];

  for (const filePath of possiblePaths) {
    try {
      await fs.access(filePath);
      return filePath;
    } catch (error) {}
  }

  throw new Error(`HTML file not found for slug: ${slug}`);
}

async function loadAuthors(siteDir) {
  const authorsPath = path.join(siteDir, 'blog', 'authors.yml');
  try {
    const authorsContent = await fs.readFile(authorsPath, 'utf8');
    return yaml.load(authorsContent);
  } catch (error) {
    console.error('Error loading authors.yml:', error);
    return {};
  }
}

function getAuthorInfo(authors, authorId) {
  const author = authors[authorId];
  if (author) {
    return {
      name: author.name || '',
      title: author.title || '',
      url: author.url || '',
      image_url: author.image_url || '',
    };
  }
  return null;
}

module.exports = function (context, options) {
  const {
    exportPaths = ['blog'],
    paginationSize = 10,
    includeDrafts = false,
    outputDir = 'json-output',
    minifyOutput = false,
    sortBy = 'date',
    sortOrder = 'desc',
    includeTagsList = true,
    includeAuthorsList = true,
    defaultImage = '',
    excludedTags = [],
    customFields = {},
    enablePagination = true,
    defaultImagePath = '',
    excludeEmptyContent = true,
    authorFallback = { name: 'Unknown Author', title: 'Contributor' },
  } = options;

  return {
    name: 'docusaurus-json-export-plugin',

    async postBuild({ outDir }) {
      console.log('JSON export plugin: postBuild started');
      const jsonOutputDir = path.join(outDir, outputDir);
      await fs.mkdir(jsonOutputDir, { recursive: true });

      const authors = await loadAuthors(context.siteDir);
      const contentList = [];
      const tagMap = new Map();
      const authorMap = new Map();

      for (const exportPath of exportPaths) {
        const sourceDir = path.join(context.siteDir, exportPath);
        const buildDir = path.join(outDir, exportPath);

        const files = await fs.readdir(sourceDir);
        const mdFiles = files.filter(file => file.endsWith('.md') || file.endsWith('.mdx'));

        console.log(`JSON export plugin: Found ${mdFiles.length} files in ${exportPath}`);

        for (const mdFile of mdFiles) {
          const originalSlug = path.basename(mdFile, path.extname(mdFile));
          const slug = removeNumberPrefix(originalSlug);
          const mdFilePath = path.join(sourceDir, mdFile);

          const mdContent = await fs.readFile(mdFilePath, 'utf8');
          const { frontMatter, content: mdContentWithoutFrontMatter } = parseFrontMatter(mdContent);

          if (frontMatter.draft && !includeDrafts) continue;

          let htmlContent;
          try {
            const htmlFilePath = await findHtmlFile(buildDir, originalSlug);
            htmlContent = await extractHtmlContent(htmlFilePath, defaultImagePath);
          } catch (error) {
            console.error(`Error reading HTML file for ${slug}`, error);
            continue;
          }

          if (excludeEmptyContent && !htmlContent.trim()) continue;

          const authorInfo = getAuthorInfo(authors, frontMatter.authors) || authorFallback;

          const blogData = {
            slug: slug,
            title: removeNumberPrefix(frontMatter.title || ''),
            seo_title: frontMatter.seo_title,
            seo_description: frontMatter.seo_description,
            date: formatDate(frontMatter.date) || '',
            date_readable: formatDate2(frontMatter.date) || '',
            excerpt: frontMatter.excerpt || '',
            image: frontMatter.image || defaultImage,
            tags: frontMatter.tags || [],
            prefix: getNumberPrefix(originalSlug),
            author: authorInfo,
            ...customFields,
          };

          const fullBlogData = {
            ...blogData,
            content: htmlContent,
            content_md: replaceRelativeImagePaths(mdContentWithoutFrontMatter, defaultImagePath),
          };

          if (excludedTags.some(tag => frontMatter.tags.includes(tag))) continue;

          // Write JSON file
          const jsonOutputPath = path.join(exportOutputDir, `${exportPath}/${slug}.json`);
          const jsonDirPath = path.dirname(jsonOutputPath);
          await fs.mkdir(jsonDirPath, { recursive: true });
          await fs.writeFile(jsonOutputPath, JSON.stringify(fullBlogData, null, minifyOutput ? 0 : 2));
          console.log(`Created JSON file: ${jsonOutputPath}`);

          // Write Markdown file
          const mdOutputPath = path.join(exportOutputDir, `${exportPath}/${slug}.md`);
          const mdDirPath = path.dirname(mdOutputPath);
          await fs.mkdir(mdDirPath, { recursive: true });
          const frontMatterString = yaml.dump(frontMatter);
          const mdOutput = `---\n${frontMatterString}---\n\n${fullBlogData.content_md}`;
          await fs.writeFile(mdOutputPath, mdOutput);
          console.log(`Created Markdown file: ${mdOutputPath}`);

          contentList.push(blogData);

          frontMatter.tags.forEach(tag => {
            if (!tagMap.has(tag)) {
              tagMap.set(tag, { count: 0, posts: [] });
            }
            tagMap.get(tag).count += 1;
            tagMap.get(tag).posts.push({ title: blogData.title, slug: blogData.slug });
          });

          const authorId = frontMatter.authors || 'unknown';
          if (!authorMap.has(authorId)) {
            authorMap.set(authorId, { ...authorInfo, id: authorId, count: 0, posts: [] });
          }
          authorMap.get(authorId).count += 1;
          authorMap.get(authorId).posts.push({ title: blogData.title, slug: blogData.slug });
        }

        contentList.sort((a, b) => {
          if (sortBy === 'date') return sortOrder === 'desc' ? new Date(b.date) - new Date(a.date) : new Date(a.date) - new Date(b.date);
          return 0;
        });
  
        if (enablePagination) {
          for (let i = 0; i < contentList.length; i += paginationSize) {
            const paginatedList = contentList.slice(i, i + paginationSize);
            const pageIndex = i / paginationSize + 1;
            const listOutputPath = path.join(jsonOutputDir, `${exportPath}/list-${pageIndex}.json`);
            const dirPath = path.dirname(listOutputPath);
            await fs.mkdir(dirPath, { recursive: true });
            await fs.writeFile(listOutputPath, JSON.stringify(paginatedList, null, minifyOutput ? 0 : 2));
            console.log(`Created ${listOutputPath}`);
          }
        }
  
        const listAllOutputPath = path.join(jsonOutputDir, `${exportPath}/list.json`);
        const dirPath = path.dirname(listAllOutputPath);
        await fs.mkdir(dirPath, { recursive: true });
        await fs.writeFile(listAllOutputPath, JSON.stringify(contentList, null, minifyOutput ? 0 : 2));
  
        console.log(`Created ${listAllOutputPath}`);
  
        if (includeTagsList) {
          const tagsData = Array.from(tagMap.entries()).map(([id, data]) => ({
            id,
            count: data.count,
            posts: data.posts,
          }));
  
          const tagsOutputPath = path.join(jsonOutputDir, `${exportPath}/tags.json`);
          const dirPath = path.dirname(tagsOutputPath);
          await fs.mkdir(dirPath, { recursive: true });
          await fs.writeFile(tagsOutputPath, JSON.stringify(tagsData, null, minifyOutput ? 0 : 2));

          console.log(`Created ${tagsOutputPath}`);
        }

        if (includeAuthorsList) {
          const authorsData = Array.from(authorMap.values());

          const authorsOutputPath = path.join(jsonOutputDir, `${exportPath}/authors.json`);
          const dirPath = path.dirname(authorsOutputPath);
          await fs.mkdir(dirPath, { recursive: true });
          await fs.writeFile(authorsOutputPath, JSON.stringify(authorsData, null, minifyOutput ? 0 : 2));

          console.log(`Created ${authorsOutputPath}`);
        }
      }

      console.log('JSON export plugin: postBuild finished');
    },
  };
}