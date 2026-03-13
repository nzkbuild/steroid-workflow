module.exports = {
    env: {
        node: true,
        commonjs: true,
        es2022: true,
    },
    parserOptions: {
        ecmaVersion: 2022,
    },
    rules: {
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        'no-undef': 'error',
        'no-constant-condition': 'warn',
        'no-duplicate-case': 'error',
        'eqeqeq': ['warn', 'smart'],
        'no-var': 'error',
        'prefer-const': 'warn',
    },
    ignorePatterns: [
        'node_modules/',
        '.memory/',
        'src/forks/',
        'skills/',
    ],
};
