# Contributing

We welcome contributions to `cliedit`!

## Setup

1.  **Fork** the repository and **clone** your fork.
2.  Install dependencies:

    ```bash
    npm install
    ```

## Development Workflow

### Building

The project is written in TypeScript. To build the project:

```bash
npm run build
```

This compiles the source code in `src/` to the `dist/` directory using `tsc`.

### Running the Demo

To test your changes interactively, you can run the included demo script:

```bash
npm run demo
```

This command builds the project and runs `src/demo.ts`, which opens the editor with some sample content.

### Testing

We use [Vitest](https://vitest.dev/) for unit testing. Please ensure all tests pass before submitting a PR.

```bash
npm test
```

### Linting

We use ESLint to maintain code quality. Please fix any linting errors:

```bash
npm run lint
```

To automatically fix some errors:

```bash
npm run lint:fix
```

## Guidelines

-   **Zero-Dependency Philosophy:** We strive to keep the runtime dependency count at zero. Avoid adding new dependencies unless absolutely necessary.
-   **Mixin Pattern:** Functionality is modularized into mixins (e.g., `editor.editing.ts`, `editor.rendering.ts`) and merged into the `CliEditor` class. Please follow this pattern for new features.
-   **Performance:** Keep rendering efficient (use `ScreenBuffer`) and avoid blocking the main thread (use Workers for heavy tasks).
