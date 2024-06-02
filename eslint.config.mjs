import eslintPluginTypescript from '@typescript-eslint/eslint-plugin';
import eslintPluginAstro from 'eslint-plugin-astro'

export default [
    ...eslintPluginAstro.configs.recommended,
    {
        "files": ["src/**/*.js", "src/**/.ts", "src/**/.astro"],
        "plugins": { eslintPluginTypescript },
        "rules": {
            "@typescript-eslint/no-unused-vars": "error",
            "@typescript-eslint/no-explicit-any": "error"
        },
        "overrides": [
            {
                "files": [
                    "*.astro"
                ],
                "parser": "astro-eslint-parser",
                "parserOptions": {
                    "parser": "@typescript-eslint/parser",
                    "extraFileExtensions": [
                        ".astro"
                    ]
                },
                "rules": {}
            }
        ]
    }
]
