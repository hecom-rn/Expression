module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    reporters: ['default', ['jest-junit', {outputDirectory: './coverage'}]],
    transformIgnorePatterns: [
        'node_modules/(?!@hecom/aDate)'
    ],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
        '^.+\\.(js|jsx)$': 'babel-jest'
    },
    globals: {
        'ts-jest': {
            isolatedModules: true
        }
    }
};
