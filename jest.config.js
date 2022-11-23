module.exports = {
    clearMocks: true,
    preset: 'ts-jest',
    testEnvironment: 'node',
    transform: {
        '^.+\\.ts?$': 'ts-jest',
    },
    setupFilesAfterEnv: ['<rootDir>/tests/singleton.ts'],
}
