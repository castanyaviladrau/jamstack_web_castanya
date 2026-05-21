const { DateTime } = require("luxon");
const fs = require("fs");
const markdownIt = require("markdown-it");
// Import the secure minifier
const htmlmin = require("html-minifier-terser");

const md = markdownIt({
  html: true,
  breaks: true,
});

module.exports = function (eleventyConfig) {
  eleventyConfig.setDataDeepMerge(true);

  eleventyConfig.addFilter("absoluteUrl", (path, base) => {
    if (!path) {
      return base;
    }

    try {
      return new URL(path, base).toString();
    } catch (error) {
      return path;
    }
  });

  eleventyConfig.addFilter("stripHtml", (content = "") => {
    return String(content).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  });

  eleventyConfig.addFilter("slugify", (value = "") => {
    return String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  });

  eleventyConfig.addTransform("htmlmin", function (content, outputPath) {
    if (outputPath && outputPath.endsWith(".html")) {
      let minified = htmlmin.minify(content, {
        useShortDoctype: true,
        removeComments: true,
        collapseWhitespace: true,
        minifyJS: true,
        minifyCSS: true,
      });
      return minified;
    }
    return content;
  });
  // ------------------------------

  eleventyConfig.addLayoutAlias("default", "layouts/base.njk");
  eleventyConfig.addLayoutAlias("base", "layouts/base.njk");
  eleventyConfig.addLayoutAlias("post", "layouts/post.njk");
  eleventyConfig.addLayoutAlias("page", "layouts/page.njk");
  eleventyConfig.addLayoutAlias("product", "layouts/product.njk");

  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat(
      "dd LLL yyyy",
    );
  });

  eleventyConfig.addFilter("htmlDateString", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("yyyy-LL-dd");
  });

  eleventyConfig.addFilter("head", (array, n) => {
    if (n < 0) return array.slice(n);
    return array.slice(0, n);
  });

  eleventyConfig.addPassthroughCopy({ "src/assets/images": "assets/images" });
  eleventyConfig.addPassthroughCopy({ "src/assets/css": "assets/css" });
  eleventyConfig.addPassthroughCopy({ "src/assets/fonts": "assets/fonts" });
  eleventyConfig.addPassthroughCopy({ "src/assets/static": "assets/static" });
  eleventyConfig.addPassthroughCopy({ "src/assets/js": "assets/js" });
  eleventyConfig.addPassthroughCopy({ "src/admin": "admin" });

  eleventyConfig.setBrowserSyncConfig({
    callbacks: {
      ready: function (err, browserSync) {
        // Wrap in a try/catch in case _site/404.html doesn't exist yet during first build
        try {
          const content_404 = fs.readFileSync("_site/404.html");
          browserSync.addMiddleware("*", (req, res) => {
            res.write(content_404);
            res.end();
          });
        } catch (e) {
          console.warn("404 page not found for Browsersync yet.");
        }
      },
    },
    ui: false,
    ghostMode: false,
  });

  eleventyConfig.addFilter("readingTime", (content) => {
    const wordsPerMinute = 200;
    const noHtml = content.replace(/<[^>]*>/g, "");
    const words = noHtml.split(/\s+/g).length;
    return Math.ceil(words / wordsPerMinute);
  });

  eleventyConfig.addFilter("markdownify", (content) => {
    if (!content) {
      return "";
    }

    return md.render(content);
  });

  eleventyConfig.addCollection("visitActivities", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("./src/visits/activities/*.md")
      .sort((a, b) => (a.data.order || 0) - (b.data.order || 0));
  });

  eleventyConfig.addCollection("recipes", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("./src/gastronomic/receptes/recipes/*.md")
      .sort((a, b) => (a.data.order || 0) - (b.data.order || 0));
  });

  eleventyConfig.addCollection("products", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("./src/shop/products/*.md")
      .sort((a, b) => a.data.title.localeCompare(b.data.title));
  });

  eleventyConfig.addCollection("posts", (collectionApi) => {
    return collectionApi.getFilteredByTag("posts").sort((a, b) => b.date - a.date);
  });

  eleventyConfig.addCollection("indexablePages", (collectionApi) => {
    return collectionApi.getAll().filter((item) => {
      if (!item.url || !item.outputPath || !item.outputPath.endsWith(".html")) {
        return false;
      }

      if (item.url.startsWith("/admin/")) {
        return false;
      }

      if (item.data.robots && String(item.data.robots).includes("noindex")) {
        return false;
      }

      return item.url !== "/404.html";
    });
  });

  return {
    templateFormats: ["md", "njk", "html", "liquid"],
    markdownTemplateEngine: "liquid",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk",
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
  };
};
