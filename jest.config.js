const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig.json');

module.exports = {
    clearMocks: true,
    preset: 'ts-jest',
    testEnvironment: 'node',
    collectCoverageFrom: [ './src/**/*.ts' ],
    transform: {
        '^.+\\.ts?$': 'ts-jest',
    },
    roots: ['tests', 'src'],
    modulePaths: [compilerOptions.baseUrl],
    moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths)
}
