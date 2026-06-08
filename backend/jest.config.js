export default {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.js"],
  setupFiles: ["<rootDir>/tests/setupEnv.js"],
  moduleNameMapper: {
    "^pdf-parse$": "<rootDir>/tests/__mocks__/pdf-parse.cjs",
  },
};
