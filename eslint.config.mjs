import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

function computeLineStarts(code) {
  const starts = [0];
  for (let i = 0; i < code.length; i++) {
    if (code.charCodeAt(i) === 10) {
      starts.push(i + 1);
    }
  }
  return starts;
}

function offsetToPosition(lineStarts, offset) {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lineStarts[mid] <= offset) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  const lineIdx = Math.max(0, high);
  return {
    line: lineIdx + 1,
    column: offset - lineStarts[lineIdx],
  };
}

function makeLoc(lineStarts, start, end) {
  return {
    start: offsetToPosition(lineStarts, start),
    end: offsetToPosition(lineStarts, end),
  };
}

function isIdentChar(ch) {
  return /[A-Za-z0-9_$]/.test(ch);
}

function skipWsAndComments(code, idx) {
  let i = idx;
  while (i < code.length) {
    const ch = code[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '/' && code[i + 1] === '/') {
      i += 2;
      while (i < code.length && code[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && code[i + 1] === '*') {
      i += 2;
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    break;
  }
  return i;
}

function readStringLiteral(code, idx) {
  const quote = code[idx];
  let i = idx + 1;
  let value = '';
  while (i < code.length) {
    const ch = code[i];
    if (ch === '\\') {
      value += code[i + 1] ?? '';
      i += 2;
      continue;
    }
    if (ch === quote) {
      return { value, end: i + 1 };
    }
    value += ch;
    i++;
  }
  return null;
}

/**
 * Lightweight TS/TSX static import/re-export parser for ESLint.
 * Supports TypeScript 7.0+ (where @typescript-eslint/parser is not yet supported)
 * and preserves `import type` / `export type ... from` declarations for no-restricted-imports.
 */
const tsImportParser = {
  meta: {
    name: 'local-ts-import-parser',
    version: '1.0.0',
  },
  parseForESLint(code) {
    const lineStarts = computeLineStarts(code);
    const body = [];
    let i = 0;

    while (i < code.length) {
      i = skipWsAndComments(code, i);
      if (i >= code.length) break;

      const ch = code[i];

      // Skip standalone string/template literals outside import/export declarations
      if (ch === "'" || ch === '"' || ch === '`') {
        if (ch === '`') {
          i++;
          while (i < code.length && code[i] !== '`') {
            if (code[i] === '\\') i++;
            i++;
          }
          i++;
        } else {
          const str = readStringLiteral(code, i);
          i = str ? str.end : i + 1;
        }
        continue;
      }

      const prevChar = i > 0 ? code[i - 1] : '';
      const atBoundary = !isIdentChar(prevChar);

      if (
        atBoundary &&
        (code.startsWith('import', i) || code.startsWith('export', i)) &&
        !isIdentChar(code[i + 6] ?? '')
      ) {
        const keyword = code.slice(i, i + 6);
        const stmtStart = i;
        let cursor = skipWsAndComments(code, i + 6);

        // Skip dynamic import(...) or import.meta
        if (keyword === 'import' && (code[cursor] === '(' || code[cursor] === '.')) {
          i = cursor + 1;
          continue;
        }

        // Side-effect import: import 'module';
        if (keyword === 'import' && (code[cursor] === "'" || code[cursor] === '"')) {
          const str = readStringLiteral(code, cursor);
          if (str) {
            const after = skipWsAndComments(code, str.end);
            const stmtEnd = code[after] === ';' ? after + 1 : str.end;
            body.push({
              type: 'ImportDeclaration',
              specifiers: [],
              source: {
                type: 'Literal',
                value: str.value,
                raw: code.slice(cursor, str.end),
                range: [cursor, str.end],
                loc: makeLoc(lineStarts, cursor, str.end),
              },
              range: [stmtStart, stmtEnd],
              loc: makeLoc(lineStarts, stmtStart, stmtEnd),
            });
            i = stmtEnd;
            continue;
          }
        }

        // Check `export * [as ns] from 'mod'` vs `export { ... } from 'mod'` vs `import ... from 'mod'`
        let isExportAll = false;
        let isValidHeader = false;

        if (keyword === 'import') {
          isValidHeader = true;
        } else if (keyword === 'export') {
          if (code[cursor] === '*') {
            isExportAll = true;
            isValidHeader = true;
          } else if (
            code.startsWith('type', cursor) &&
            !isIdentChar(code[cursor + 4] ?? '')
          ) {
            const afterType = skipWsAndComments(code, cursor + 4);
            if (code[afterType] === '{' || code[afterType] === '*') {
              isExportAll = code[afterType] === '*';
              isValidHeader = true;
            }
          } else if (code[cursor] === '{') {
            isValidHeader = true;
          }
        }

        if (isValidHeader) {
          let braceDepth = 0;
          let foundSource = null;
          let stmtEnd = cursor;

          while (cursor < code.length) {
            cursor = skipWsAndComments(code, cursor);
            if (cursor >= code.length) break;

            const cur = code[cursor];
            if (cur === '{') {
              braceDepth++;
              cursor++;
              continue;
            }
            if (cur === '}') {
              braceDepth = Math.max(0, braceDepth - 1);
              cursor++;
              continue;
            }
            if (braceDepth === 0 && cur === ';') {
              stmtEnd = cursor + 1;
              break;
            }
            if (cur === "'" || cur === '"') {
              const str = readStringLiteral(code, cursor);
              cursor = str ? str.end : cursor + 1;
              continue;
            }
            if (
              braceDepth === 0 &&
              code.startsWith('from', cursor) &&
              !isIdentChar(code[cursor - 1] ?? '') &&
              !isIdentChar(code[cursor + 4] ?? '')
            ) {
              const afterFrom = skipWsAndComments(code, cursor + 4);
              if (code[afterFrom] === "'" || code[afterFrom] === '"') {
                const str = readStringLiteral(code, afterFrom);
                if (str) {
                  foundSource = {
                    value: str.value,
                    start: afterFrom,
                    end: str.end,
                  };
                  const afterStr = skipWsAndComments(code, str.end);
                  stmtEnd = code[afterStr] === ';' ? afterStr + 1 : str.end;
                  break;
                }
              }
            }
            // Stop at newline if an export { foo } had no `from` and hit next declaration
            if (
              braceDepth === 0 &&
              keyword === 'export' &&
              foundSource === null &&
              cur === '\n'
            ) {
              stmtEnd = cursor;
              break;
            }
            cursor++;
          }

          if (foundSource) {
            const sourceNode = {
              type: 'Literal',
              value: foundSource.value,
              raw: code.slice(foundSource.start, foundSource.end),
              range: [foundSource.start, foundSource.end],
              loc: makeLoc(lineStarts, foundSource.start, foundSource.end),
            };
            const nodeType =
              keyword === 'import'
                ? 'ImportDeclaration'
                : isExportAll
                  ? 'ExportAllDeclaration'
                  : 'ExportNamedDeclaration';

            const node = {
              type: nodeType,
              source: sourceNode,
              range: [stmtStart, stmtEnd],
              loc: makeLoc(lineStarts, stmtStart, stmtEnd),
            };

            if (nodeType === 'ImportDeclaration' || nodeType === 'ExportNamedDeclaration') {
              node.specifiers = [];
            }
            if (nodeType === 'ExportNamedDeclaration') {
              node.declaration = null;
            }
            if (nodeType === 'ExportAllDeclaration') {
              node.exported = null;
            }

            body.push(node);
            i = stmtEnd;
            continue;
          }
        }
      }

      i++;
    }

    return {
      ast: {
        type: 'Program',
        sourceType: 'module',
        body,
        comments: [],
        tokens: [],
        range: [0, code.length],
        loc: makeLoc(lineStarts, 0, code.length),
      },
    };
  },
};

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*'],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsImportParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
  // 1. Frontend consumers & contexts: cannot reach into implementations/, backend/, or Firebase SDKs directly
  {
    files: ['web-app/src/**/*.ts', 'web-app/src/**/*.tsx'],
    ignores: ['**/modules/*/index.ts', '**/modules/*/implementations/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'firebase',
              message:
                'Use web-app/src/modules/auth or web-app/src/modules/database barrels instead of importing Firebase directly.',
            },
          ],
          patterns: [
            {
              regex: '(^|/)implementations(/|$)',
              message:
                'Import from the module barrel (modules/<name>/index.ts) or *.interface.ts instead of reaching into implementations/.',
            },
            {
              regex: '(^|/)backend(/|$)',
              message:
                'Frontend code cannot import from backend/. Place shared contracts in shared/types/.',
            },
            {
              group: ['firebase/*'],
              message:
                'Use web-app/src/modules/auth or web-app/src/modules/database barrels instead of importing Firebase SDKs directly.',
            },
          ],
        },
      ],
    },
  },
  // 2. Frontend module barrels & adapters: cannot import from backend/
  {
    files: [
      'web-app/src/modules/*/index.ts',
      'web-app/src/modules/*/implementations/**/*.ts',
      'web-app/src/modules/*/implementations/**/*.tsx',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)backend(/|$)',
              message:
                'Frontend modules cannot import from backend/. Place shared contracts in shared/types/.',
            },
          ],
        },
      ],
    },
  },
  // 3. Backend routes & entry points: cannot reach into implementations/, web-app/, or vendor AI/Auth SDKs directly
  {
    files: ['server.ts', 'backend/server.ts', 'backend/src/**/*.ts'],
    ignores: ['**/modules/*/index.ts', '**/modules/*/implementations/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@google/genai',
              message:
                'Use backend/src/modules/ai-providers barrel instead of importing @google/genai directly.',
            },
            {
              name: 'firebase-admin',
              message:
                'Use backend/src/modules/auth barrel instead of importing firebase-admin directly.',
            },
          ],
          patterns: [
            {
              regex: '(^|/)implementations(/|$)',
              message:
                'Import from the module barrel (modules/<name>/index.ts) or *.interface.ts instead of reaching into implementations/.',
            },
            {
              regex: '(^|/)web-app(/|$)',
              message:
                'Backend code cannot import from web-app/. Place shared contracts in shared/types/.',
            },
            {
              group: ['firebase-admin/*'],
              message:
                'Use backend/src/modules/auth barrel instead of importing firebase-admin SDKs directly.',
            },
          ],
        },
      ],
    },
  },
  // 4. Backend module barrels & adapters: cannot import from web-app/
  {
    files: [
      'backend/src/modules/*/index.ts',
      'backend/src/modules/*/implementations/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)web-app(/|$)',
              message:
                'Backend modules cannot import from web-app/. Place shared contracts in shared/types/.',
            },
          ],
        },
      ],
    },
  },
  // 5. Pure interfaces & shared contracts: zero vendor SDKs, runtime frameworks, or implementations/
  {
    files: ['**/*.interface.ts', 'shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'express',
              message:
                'Interfaces and shared types must stay framework-agnostic (no Express imports).',
            },
            {
              name: 'multer',
              message:
                'Interfaces and shared types must not import Multer.',
            },
            {
              name: 'react',
              message:
                'Interfaces and shared types must not depend on React.',
            },
            {
              name: 'react-dom',
              message:
                'Interfaces and shared types must not depend on React DOM.',
            },
            {
              name: '@google/genai',
              message:
                'Interfaces and shared types must not import AI SDKs.',
            },
            {
              name: 'firebase',
              message:
                'Interfaces and shared types must not import Firebase SDKs.',
            },
            {
              name: 'firebase-admin',
              message:
                'Interfaces and shared types must not import Firebase Admin SDKs.',
            },
          ],
          patterns: [
            {
              regex: '(^|/)implementations(/|$)',
              message: 'Interfaces and shared types must never import from implementations/.',
            },
            {
              regex: '(^|/)(backend|web-app)(/|$)',
              message: 'Shared types must stay independent from backend/ and web-app/.',
            },
            {
              group: ['firebase/*', 'firebase-admin/*', 'node:*'],
              message:
                'Interfaces and shared types must stay free of vendor SDK or Node runtime imports.',
            },
          ],
        },
      ],
    },
  },
];
