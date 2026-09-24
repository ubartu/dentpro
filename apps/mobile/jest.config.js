module.exports = {
  preset: "jest-expo",
  testTimeout: 15000,
  testMatch: ["**/__tests__/**/*.test.ts?(x)"],
  moduleNameMapper: {
    "^react/package.json$": require.resolve("react/package.json"),
    "^react-test-renderer/package.json$":
      require.resolve("react-test-renderer/package.json"),
    "^react$": require.resolve("react"),
    "^react/jsx-runtime$": require.resolve("react/jsx-runtime"),
    "^react/jsx-dev-runtime$": require.resolve("react/jsx-dev-runtime"),
    "^react-test-renderer$": require.resolve("react-test-renderer"),
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
};
