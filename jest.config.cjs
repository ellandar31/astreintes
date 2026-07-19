module.exports = {
  collectCoverageFrom: [
    "src/app/**/*.ts",
    "!src/app/**/*.spec.ts",
    "!src/app/**/*.jest-spec.ts",
    "!src/main.ts",
    "!src/app/**/*.models.ts",
    "!src/app/**/*.actions.ts",
    "!src/app/**/*.effects.ts",
    "!src/app/**/*.config.ts",
  ],
  coverageDirectory: "coverage/jest",
  moduleFileExtensions: ["ts", "js", "json"],
  preset: "jest-preset-angular",
  setupFilesAfterEnv: ["<rootDir>/setup-jest.ts"],
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/src/**/*.jest-spec.ts"],
  transform: {
    "^.+\\.(ts|js|mjs|html|svg)$": [
      "jest-preset-angular",
      {
        stringifyContentPathRegex: "\\.(html|svg)$",
        tsconfig: "<rootDir>/tsconfig.jest.json",
      },
    ],
  },
  transformIgnorePatterns: ["node_modules/(?!.*\\.mjs$|@angular|@ngrx|rxjs|tslib)"],
};
