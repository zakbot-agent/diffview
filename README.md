# diffview

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg) ![License](https://img.shields.io/badge/license-MIT-green.svg) ![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg)

> Beautiful side-by-side diff viewer for terminal and browser

## Features

- CLI tool
- TypeScript support

## Tech Stack

**Runtime:**
- TypeScript

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn

## Installation

```bash
cd diffview
npm install
```

Or install globally:

```bash
npm install -g diffview
```

## Usage

### CLI

```bash
diffview
```

### Available Scripts

| Script | Command |
|--------|---------|
| `npm run build` | `tsc` |
| `npm run start` | `node dist/index.js` |

## Project Structure

```
├── public
│   └── index.html
├── src
│   ├── differ.ts
│   ├── formatter.ts
│   ├── git.ts
│   ├── index.ts
│   └── server.ts
├── package.json
├── README.md
└── tsconfig.json
```

## License

This project is licensed under the **MIT** license.

## Author

**Zakaria Kone**
