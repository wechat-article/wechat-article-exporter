/**
 * 安全解析 JS 对象/数组字面量（无需执行脚本）
 * 处理微信文章数据中的常见格式：无引号 key、单引号字符串、trailing comma
 */
export function parseJSObject<T = any>(expr: string): T {
  const normalized = normalizeObjectLiteralForJson(expr.trim());
  return JSON.parse(normalized);
}

const JS_STRING_LITERAL_PATTERN = String.raw`'(?:\\[\s\S]|[^'\\])*'|"(?:\\[\s\S]|[^"\\])*"`;
const JS_DECODE_CALL_RE = new RegExp(String.raw`\bJsDecode\(\s*(${JS_STRING_LITERAL_PATTERN})\s*\)`, 'g');
const NUMERIC_STRING_COERCION_RE = new RegExp(String.raw`(${JS_STRING_LITERAL_PATTERN})\s*\*\s*1`, 'g');

function isWhitespace(char: string): boolean {
  return /\s/.test(char);
}

function isIdentifierStart(char: string | undefined): boolean {
  return !!char && /[A-Za-z_$]/.test(char);
}

function isIdentifierPart(char: string | undefined): boolean {
  return !!char && /[A-Za-z0-9_$]/.test(char);
}

function readQuotedStringLiteral(input: string, startIndex: number): { literal: string; endIndex: number } {
  const quote = input[startIndex];
  let escaped = false;

  for (let i = startIndex + 1; i < input.length; i++) {
    const char = input[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === quote) {
      return { literal: input.slice(startIndex, i + 1), endIndex: i };
    }
  }

  return { literal: input.slice(startIndex), endIndex: input.length - 1 };
}

function skipLineComment(input: string, startIndex: number): number {
  let i = startIndex + 2;
  while (i < input.length && input[i] !== '\n' && input[i] !== '\r') i++;
  return i;
}

function skipBlockComment(input: string, startIndex: number): number {
  const endIndex = input.indexOf('*/', startIndex + 2);
  return endIndex >= 0 ? endIndex + 2 : input.length;
}

function skipWhitespaceAndComments(input: string, startIndex: number): number {
  let i = startIndex;

  while (i < input.length) {
    while (i < input.length && isWhitespace(input[i])) i++;

    if (input[i] === '/' && input[i + 1] === '/') {
      i = skipLineComment(input, i);
      continue;
    }

    if (input[i] === '/' && input[i + 1] === '*') {
      i = skipBlockComment(input, i);
      continue;
    }

    return i;
  }

  return i;
}

function appendWhitespaceSkippingComments(input: string, startIndex: number): { text: string; nextIndex: number } {
  let i = startIndex;
  let text = '';

  while (i < input.length) {
    while (i < input.length && isWhitespace(input[i])) {
      text += input[i];
      i++;
    }

    if (input[i] === '/' && input[i + 1] === '/') {
      i = skipLineComment(input, i);
      continue;
    }

    if (input[i] === '/' && input[i + 1] === '*') {
      i = skipBlockComment(input, i);
      continue;
    }

    break;
  }

  return { text, nextIndex: i };
}

function normalizeObjectLiteralForJson(input: string): string {
  let output = '';
  let i = 0;

  while (i < input.length) {
    const char = input[i];
    const next = input[i + 1];

    if (char === '"' || char === "'") {
      const { literal, endIndex } = readQuotedStringLiteral(input, i);
      output += JSON.stringify(decodeJsStringLiteral(literal));
      i = endIndex + 1;
      continue;
    }

    if (char === '/' && next === '/') {
      i = skipLineComment(input, i);
      continue;
    }

    if (char === '/' && next === '*') {
      i = skipBlockComment(input, i);
      continue;
    }

    if (char === ',') {
      const nextSignificant = skipWhitespaceAndComments(input, i + 1);
      if (input[nextSignificant] === '}' || input[nextSignificant] === ']') {
        i++;
        continue;
      }
    }

    if (char === '{' || char === ',') {
      output += char;
      i++;

      const whitespace = appendWhitespaceSkippingComments(input, i);
      output += whitespace.text;
      i = whitespace.nextIndex;

      if (isIdentifierStart(input[i])) {
        const keyStart = i;
        i++;
        while (isIdentifierPart(input[i])) i++;

        const key = input.slice(keyStart, i);
        const colonIndex = skipWhitespaceAndComments(input, i);

        if (input[colonIndex] === ':') {
          output += JSON.stringify(key);
          i = colonIndex;
          continue;
        }

        output += key;
        continue;
      }

      continue;
    }

    output += char;
    i++;
  }

  return output;
}

/**
 * Decode a JS string literal without executing the source script.
 */
export function decodeJsStringLiteral(literal: string): string {
  const quote = literal[0];
  if (!['"', "'"].includes(quote) || literal[literal.length - 1] !== quote) {
    throw new Error('Invalid JS string literal');
  }

  let decoded = '';
  const body = literal.slice(1, -1);

  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    if (char !== '\\') {
      decoded += char;
      continue;
    }

    const next = body[++i];
    if (next === undefined) {
      decoded += '\\';
      break;
    }

    switch (next) {
      case '0':
        decoded += '\0';
        break;
      case 'b':
        decoded += '\b';
        break;
      case 'f':
        decoded += '\f';
        break;
      case 'n':
        decoded += '\n';
        break;
      case 'r':
        decoded += '\r';
        break;
      case 't':
        decoded += '\t';
        break;
      case 'v':
        decoded += '\v';
        break;
      case 'x': {
        const hex = body.slice(i + 1, i + 3);
        if (/^[0-9a-fA-F]{2}$/.test(hex)) {
          decoded += String.fromCharCode(parseInt(hex, 16));
          i += 2;
        } else {
          decoded += `\\${next}`;
        }
        break;
      }
      case 'u': {
        if (body[i + 1] === '{') {
          const end = body.indexOf('}', i + 2);
          const hex = end >= 0 ? body.slice(i + 2, end) : '';
          if (/^[0-9a-fA-F]+$/.test(hex)) {
            decoded += String.fromCodePoint(parseInt(hex, 16));
            i = end;
            break;
          }
        }

        const hex = body.slice(i + 1, i + 5);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          decoded += String.fromCharCode(parseInt(hex, 16));
          i += 4;
        } else {
          decoded += `\\${next}`;
        }
        break;
      }
      case '\n':
        break;
      case '\r':
        if (body[i + 1] === '\n') i++;
        break;
      default:
        decoded += next;
        break;
    }
  }

  return decoded;
}

function decodeWechatEscapedString(value: string): string {
  return value
    .replace(/\\x([0-9a-fA-F]{2})/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Normalize WeChat's common JS literal forms before JSON parsing.
 */
export function normalizeWechatJsLiteral(expr: string): string {
  return expr
    .replace(JS_DECODE_CALL_RE, (_match, literal: string) =>
      JSON.stringify(decodeWechatEscapedString(decodeJsStringLiteral(literal)))
    )
    .replace(NUMERIC_STRING_COERCION_RE, (_match, literal: string) => {
      const value = Number(decodeJsStringLiteral(literal));
      return Number.isFinite(value) ? String(value) : 'null';
    });
}

/**
 * Parse a WeChat JS object/array literal without executing page scripts.
 */
export function parseWechatJSObject<T = any>(expr: string): T {
  return parseJSObject<T>(normalizeWechatJsLiteral(expr));
}

/**
 * Extract an object/array literal by balancing braces while ignoring strings and comments.
 */
export function extractBalancedJsLiteral(source: string, startIndex: number): string | null {
  const opener = source[startIndex];
  const closer = opener === '{' ? '}' : opener === '[' ? ']' : null;
  if (!closer) return null;

  const stack: string[] = [];
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = startIndex; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (char === '\n' || char === '\r') inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }

    if (char === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === '{') {
      stack.push('}');
    } else if (char === '[') {
      stack.push(']');
    } else if (char === '}' || char === ']') {
      if (stack.pop() !== char) return null;
      if (stack.length === 0) return source.slice(startIndex, i + 1);
    }
  }

  return null;
}

/**
 * 从 `window.xxx = <expr>;` 形式的代码中提取表达式并解析
 */
export function parseWindowAssignment<T = any>(code: string, varName: string): T {
  const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`window\\.${escaped}\\s*=\\s*([\\s\\S]+?);?\\s*$`);
  const match = code.match(pattern);
  if (!match) throw new Error(`无法从代码中提取 ${varName}`);
  return parseJSObject<T>(match[1]);
}
