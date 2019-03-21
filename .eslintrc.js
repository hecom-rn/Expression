module.exports = {
    env: {
        node: true,
    },
    plugins: [
        "automatic",
    ],
    extends: [
        "plugin:automatic/typescript",
    ],
    rules: {
        "no-undefined": 0,
        "no-console": 0,
    },
};