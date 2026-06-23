/** Pure-TS domain package: ts-jest transforms the .test.ts files. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // M6 #48 coverage gate. Domain is the pure business-logic core (interest,
  // points, recurrence) and sits at 100%; 70% is the floor a failing run trips.
  coverageThreshold: {
    global: { statements: 70, branches: 70, functions: 70, lines: 70 },
  },
};
