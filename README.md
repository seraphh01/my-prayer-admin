# MyPrayerAdmin

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.0.6.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Import Word

Reguli comune pentru `/sections/import` și `/prayers/import` (afișate și în aplicație):

| Stil Word | Rol |
|-----------|-----|
| Heading 1 | Titlu rugăciune |
| Subtitle 1 | Subtitlu rugăciune (opțional) |
| Heading 2 | Titlu secțiune |
| Subtitle 2 | Subtitlu secțiune (opțional) |
| Heading 3 | Titlu text liturgic |
| Paragraf (rânduri) | Câte o frază pe rând |
| Cursiv / bold | Tip frază (`italicText` / `boldText`) |
| `<< … >>` | Citat (`quoteText`) |

Textele liturgice nu au subtitlu. Titlurile se editează după încărcarea fișierului, în previzualizare.

- **Secțiune nouă** (`/sections/import`): un document cu H2 (+ H3 + fraze); salvare intermediară per text sau secțiune.
- **Rugăciune nouă** (`/prayers/import`): H1 + H2 + H3; creează rugăciunea, secțiunile și textele; aceeași salvare intermediară.
- La același titlu: text existent sau text nou.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
