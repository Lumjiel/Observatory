export default function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets");
  
  eleventyConfig.addFilter("jsonify", (data) => JSON.stringify(data));
  
  eleventyConfig.addFilter("filterByType", (logs, type) => {
    return logs.filter(log => log.type === type);
  });
  
  eleventyConfig.addFilter("sortByDate", (logs) => {
    return [...logs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  });
  
  eleventyConfig.addFilter("recentLogs", (logs, count = 20) => {
    return [...logs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, count);
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      layouts: "layouts",
      data: "_data"
    },
    templateFormats: ["njk", "md", "html"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};
