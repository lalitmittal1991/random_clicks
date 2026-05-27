/** @type {import('vitest/config').UserConfig} */
module.exports = {
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    reporters: ["default", "junit"],
    outputFile: {
      junit: "./test-results/junit.xml",
    },
    coverage: {
      reporter: ["text", "html"],
    },
  },
};
