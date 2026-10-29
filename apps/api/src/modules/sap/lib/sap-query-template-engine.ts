// Bộ máy xử lý câu truy vấn động SAP HANA:
// 1. Chuẩn hóa văn bản SQL & băm SHA-256 (`normalizeSqlText`, `computeSqlHash`)
// 2. Bung biến runtime 1 lượt có kiểm tra định dạng (`expandCatalogTemplate`, `renderCatalogSql`)
// 3. Kiểm tra tĩnh 4 lớp bằng State-Machine Lexer (`validateQueryStatic`)
// 4. Đối chiếu Hợp đồng Cột, khóa khử trùng `dedupKeys` và ngữ nghĩa KPI (`compareQueryColumns`)
import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { type OpenQuerySql, wrapOpenquery } from './openquery';
import {
   MONITOR_DEFAULT_BRAND,
  MONITOR_DEFAULT_DATE,
  SALES_PO_VENDOR_CODE,
  SAP_SCHEMA_KBMD,
  SAP_SCHEMA_TTVH,
} from './sap-constants';
import {
  assertPoNumbers,
  assertSapBrand,
  assertSapDate,
} from './sap-query-params';
import type { SapCellValue } from './sap-row-normalizer';
import type { SapQueryCatalogEntry } from '../queries/sap-query-catalog';

/** Ngưỡng tối đa an toàn của chuỗi bên trong OPENQUERY (chừa biên an toàn dưới mức cứng 8000 của SQL Server). */
export const OPENQUERY_SAFE_MAX_LENGTH = 7800;

/** Số lượng PO tối đa của 1 lô truy vấn Nhóm Cũ để đo độ dài kịch bản xấu nhất. */
export const WORST_CASE_PO_BATCH_SIZE = 300;

const WORST_CASE_PO_NUMBERS: readonly number[] = Array.from(
  { length: WORST_CASE_PO_BATCH_SIZE },
  (_, index) => 1_000_000 + index,
);

const ALLOWED_SCHEMAS: Record<string, true> = {
  [SAP_SCHEMA_TTVH.toLowerCase()]: true,
  [SAP_SCHEMA_KBMD.toLowerCase()]: true,
};

const FORBIDDEN_SQL_KEYWORDS: Record<string, true> = {
  INSERT: true,
  UPDATE: true,
  DELETE: true,
  MERGE: true,
  UPSERT: true,
  DROP: true,
  ALTER: true,
  CREATE: true,
  TRUNCATE: true,
  GRANT: true,
  REVOKE: true,
  CALL: true,
  EXEC: true,
  EXECUTE: true,
  INTO: true,
};

const FROM_CLAUSE_TERMINATORS: Record<string, true> = {
  WHERE: true,
  GROUP: true,
  HAVING: true,
  ORDER: true,
  LIMIT: true,
  OFFSET: true,
  FETCH: true,
  UNION: true,
  EXCEPT: true,
  INTERSECT: true,
  MINUS: true,
  WINDOW: true,
  FOR: true,
};

export interface RenderSqlParams {
  readonly dateFrom: string;
  readonly brand: string;
  readonly poNumbers?: readonly number[];
}

export interface StaticCheckSteps {
  readonly placeholdersOk: boolean;
  readonly readOnlySelectOk: boolean;
  readonly allowedTablesOk: boolean;
  readonly openQueryLengthOk: boolean;
}

export interface StaticValidationResult {
  readonly valid: boolean;
  readonly sqlHash: string;
  readonly worstCaseOpenQueryLength: number;
  readonly maxOpenQueryLength: number;
  readonly detectedPlaceholders: string[];
  readonly missingPlaceholders: string[];
  readonly unexpectedPlaceholders: string[];
  readonly referencedTables: string[];
  readonly steps: StaticCheckSteps;
  readonly errors: string[];
}

export type SapColumnCheckKind = 'required' | 'baseline_optional' | 'extra';
export type SapColumnCheckStatus =
  | 'present'
  | 'missing'
  | 'removed'
  | 'added'
  | 'unsupported_extra';

export interface SapQueryColumnCheckItem {
  readonly columnName: string;
  readonly kind: SapColumnCheckKind;
  readonly status: SapColumnCheckStatus;
}

export interface ColumnDiffResult {
  readonly valid: boolean;
  readonly requiredColumns: string[];
  readonly baselineColumns: string[];
  readonly actualColumns: string[];
  readonly missingColumns: string[];
  readonly extraColumns: string[];
  readonly duplicateKeyCount: number;
  readonly columnChecks: SapQueryColumnCheckItem[];
  readonly warnings: string[];
  readonly semanticErrors: string[];
}

/**
 * Chuẩn hóa văn bản SQL (đổi CRLF về LF và cắt khoảng trắng hai đầu)
 * để dùng thống nhất giữa client và server khi tính hash.
 */
export function normalizeSqlText(sqlText: string): string {
  return sqlText.replace(/\r\n/g, '\n').trim();
}

/**
 * Tính mã băm SHA-256 (hex) trên văn bản SQL đã chuẩn hóa.
 */
export function computeSqlHash(sqlText: string): string {
  return createHash('sha256')
    .update(normalizeSqlText(sqlText), 'utf8')
    .digest('hex');
}

/**
 * Bung các biến runtime (`{d}`, `{br}`, `{po_filter}`, `{brand}`, `{date_cond}`)
 * trong 1 lượt regex duy nhất sau khi đã kiểm tra nghiêm ngặt định dạng tham số.
 */
export function expandCatalogTemplate(
  sqlText: string,
  params: RenderSqlParams,
): string {
  const { dateFrom, brand, poNumbers } = params;
  assertSapDate(dateFrom);
  assertSapBrand(brand);
  if (poNumbers !== undefined) {
    assertPoNumbers(poNumbers);
  }

  const isAllBrand = brand.toUpperCase() === 'ALL';
  const br = isAllBrand
    ? `JOIN ${SAP_SCHEMA_TTVH}.OWHS W ON W."WhsCode" = P."U_Store" AND W."U_Brand" IS NOT NULL`
    : `JOIN ${SAP_SCHEMA_TTVH}.OWHS W ON W."WhsCode" = P."U_Store" AND W."U_Brand" = '${brand}'`;
  const poFilter =
    poNumbers !== undefined
      ? `P."CardCode" = '${SALES_PO_VENDOR_CODE}' AND P."CANCELED" = 'N' AND P."DocNum" IN (${poNumbers.join(', ')})`
      : `P."CardCode" = '${SALES_PO_VENDOR_CODE}' AND P."CANCELED" = 'N' AND P."DocDate" >= '${dateFrom}'`;
  const dateCond =
    poNumbers !== undefined
      ? `P."DocNum" IN (${poNumbers.join(', ')})`
      : `P."DocDate" >= '${dateFrom}'`;

  let preparedSql = sqlText;
  if (isAllBrand) {
    preparedSql = preparedSql
      .replace(/([A-Za-z0-9_."]*?"U_Brand")\s*=\s*'\{brand\}'/gi, '$1 IS NOT NULL')
      .replace(/'\{brand\}'\s*=\s*([A-Za-z0-9_."]*?"U_Brand")/gi, '$1 IS NOT NULL');
    if (preparedSql.includes('{brand}')) {
      throw new BadRequestException(
        'Câu truy vấn chứa biến {brand} không tương thích với chế độ Tất cả thương hiệu (ALL); yêu cầu mẫu W."U_Brand" = \'{brand}\'',
      );
    }
  }

  const replacements: Record<string, string> = {
    '{d}': dateFrom,
    '{br}': br,
    '{po_filter}': poFilter,
    '{brand}': brand,
    '{date_cond}': dateCond,
  };

  return preparedSql.replace(
    /\{(d|br|po_filter|brand|date_cond)\}/g,
    (match) => replacements[match] ?? match,
  );
}

/**
 * Kiểm tra tham số runtime, bung biến 1 lượt và bọc vào `OPENQUERY(hana_mc, '...')`.
 */
export function renderCatalogSql(
  sqlText: string,
  params: RenderSqlParams,
): OpenQuerySql {
  const expanded = expandCatalogTemplate(sqlText, params);
  return wrapOpenquery(expanded);
}

interface SqlToken {
  readonly type:
    | 'word'
    | 'quoted_ident'
    | 'string'
    | 'dot'
    | 'comma'
    | 'lparen'
    | 'rparen'
    | 'semicolon'
    | 'other';
  readonly value: string;
  readonly upper: string;
}

interface LexResult {
  readonly tokens: SqlToken[];
  readonly cleanedSql: string;
  readonly hasComments: boolean;
  readonly hasUnclosedLiteralOrIdentifier: boolean;
}

/**
 * State-machine lexer một lượt:
 * - Phát hiện comment `--` hoặc `/* ... *\/` nằm ngoài chuỗi `'...'` và định danh `"..."`.
 * - Thay nội dung bên trong `'...'` bằng `''` và bên trong `"..."` bằng `"_id"` trên `cleanedSql`.
 * - Tách danh sách token chuẩn hóa để kiểm tra từ khóa cấm và định danh bảng sau `FROM`/`JOIN`.
 */
function lexSql(sql: string): LexResult {
  const tokens: SqlToken[] = [];
  const cleanedParts: string[] = [];
  let hasComments = false;
  let state: 'normal' | 'single_quote' | 'double_quote' = 'normal';
  let currentLiteral = '';
  let i = 0;
  const len = sql.length;

  while (i < len) {
    const ch = sql[i]!;
    const next = i + 1 < len ? sql[i + 1]! : '';

    if (state === 'single_quote') {
      if (ch === "'" && next === "'") {
        currentLiteral += "''";
        i += 2;
        continue;
      }
      if (ch === "'") {
        tokens.push({ type: 'string', value: `'${currentLiteral}'`, upper: "''" });
        cleanedParts.push("''");
        currentLiteral = '';
        state = 'normal';
        i++;
        continue;
      }
      currentLiteral += ch;
      i++;
      continue;
    }

    if (state === 'double_quote') {
      if (ch === '"' && next === '"') {
        currentLiteral += '""';
        i += 2;
        continue;
      }
      if (ch === '"') {
        tokens.push({
          type: 'quoted_ident',
          value: `"${currentLiteral}"`,
          upper: `"${currentLiteral.toUpperCase()}"`,
        });
        cleanedParts.push('"_id"');
        currentLiteral = '';
        state = 'normal';
        i++;
        continue;
      }
      currentLiteral += ch;
      i++;
      continue;
    }

    // state === 'normal'
    if (ch === '-' && next === '-') {
      hasComments = true;
      i += 2;
      while (i < len && sql[i] !== '\n') {
        i++;
      }
      continue;
    }

    if (ch === '/' && next === '*') {
      hasComments = true;
      i += 2;
      while (i < len && !(sql[i] === '*' && sql[i + 1] === '/')) {
        i++;
      }
      if (i < len) {
        i += 2;
      }
      continue;
    }

    if (ch === "'") {
      state = 'single_quote';
      currentLiteral = '';
      i++;
      continue;
    }

    if (ch === '"') {
      state = 'double_quote';
      currentLiteral = '';
      i++;
      continue;
    }

    if (/\s/.test(ch)) {
      cleanedParts.push(ch);
      i++;
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let word = ch;
      i++;
      while (i < len && /[A-Za-z0-9_]/.test(sql[i]!)) {
        word += sql[i]!;
        i++;
      }
      const upper = word.toUpperCase();
      tokens.push({ type: 'word', value: word, upper });
      cleanedParts.push(word);
      continue;
    }

    cleanedParts.push(ch);
    if (ch === '.') {
      tokens.push({ type: 'dot', value: '.', upper: '.' });
    } else if (ch === ',') {
      tokens.push({ type: 'comma', value: ',', upper: ',' });
    } else if (ch === '(') {
      tokens.push({ type: 'lparen', value: '(', upper: '(' });
    } else if (ch === ')') {
      tokens.push({ type: 'rparen', value: ')', upper: ')' });
    } else if (ch === ';') {
      tokens.push({ type: 'semicolon', value: ';', upper: ';' });
    } else {
      tokens.push({ type: 'other', value: ch, upper: ch });
    }
    i++;
  }

  return {
    tokens,
    cleanedSql: cleanedParts.join(''),
    hasComments,
    hasUnclosedLiteralOrIdentifier: state !== 'normal',
  };
}

/**
 * Kiểm tra định danh bảng đứng tại vị trí `startIdx` trong mảng token (sau `FROM`, `JOIN`, hoặc dấu `,` trong `FROM`).
 * Trả về vị trí token kế tiếp sau định danh bảng (hoặc subquery) và ghi nhận bảng hợp lệ/lỗi.
 */
function inspectTableTarget(
  tokens: readonly SqlToken[],
  startIdx: number,
  referencedTables: string[],
  invalidTables: string[],
): number {
  const first = tokens[startIdx];
  if (!first) {
    invalidTables.push('<thiếu tên bảng>');
    return startIdx;
  }

  // Trường hợp subquery: FROM (SELECT ...) -> kiểm tra bên trong bắt đầu bằng SELECT/WITH và nhảy qua dấu đóng ngoặc ')' tương ứng
  if (first.type === 'lparen') {
    let lookahead = startIdx;
    while (tokens[lookahead]?.type === 'lparen') {
      lookahead++;
    }
    const innerFirst = tokens[lookahead];
    if (
      !innerFirst ||
      innerFirst.type !== 'word' ||
      (innerFirst.upper !== 'SELECT' && innerFirst.upper !== 'WITH')
    ) {
      invalidTables.push(`(${innerFirst?.value ?? ''})`);
    }
    let depth = 0;
    let closeIdx = startIdx;
    while (closeIdx < tokens.length) {
      if (tokens[closeIdx]!.type === 'lparen') {
        depth++;
      } else if (tokens[closeIdx]!.type === 'rparen') {
        depth--;
        if (depth === 0) {
          return closeIdx + 1;
        }
      }
      closeIdx++;
    }
    return closeIdx;
  }

  const second = tokens[startIdx + 1];
  const third = tokens[startIdx + 2];
  const fourth = tokens[startIdx + 3];

  if (second?.type === 'dot' && third) {
    const schemaRaw = first.value;
    const tableRaw = third.value;
    const combined = `${schemaRaw}.${tableRaw}`;

    const isAllowedSchema =
      first.type === 'word' && Boolean(ALLOWED_SCHEMAS[schemaRaw.toLowerCase()]);
    const isValidTableToken =
      (third.type === 'word' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(tableRaw)) ||
      (third.type === 'quoted_ident' &&
        /^"[A-Za-z_][A-Za-z0-9_]*"$/.test(tableRaw));
    const hasTrailingDot = fourth?.type === 'dot';

    if (isAllowedSchema && isValidTableToken && !hasTrailingDot) {
      referencedTables.push(combined);
    } else {
      invalidTables.push(
        hasTrailingDot && tokens[startIdx + 4]
          ? `${combined}.${tokens[startIdx + 4]!.value}`
          : combined,
      );
    }
    return startIdx + 3;
  }

  invalidTables.push(first.value);
  return startIdx + 1;
}

/**
 * Kiểm tra tĩnh 4 lớp trên câu truy vấn SQL trước khi cho phép chạy thử hoặc xuất bản:
 * 1. Biến runtime (`allowedPlaceholders`) trên văn bản gốc trước khi tách chuỗi.
 * 2. Chỉ đọc (`SELECT`/`WITH`), không có comment `--`/`/* *\/`, không có `;` và từ khóa cấm.
 * 3. Mọi bảng sau `FROM`/`JOIN` phải có tiền tố `maycha_live.<Table>` hoặc `kbmd_live.<Table>`.
 * 4. Độ dài phần trong `OPENQUERY` ở kịch bản lô 300 PO (7 chữ số) <= 7800 ký tự.
 */
export function validateQueryStatic(
  entry: SapQueryCatalogEntry,
  sqlText: string,
): StaticValidationResult {
  const normalized = normalizeSqlText(sqlText);
  const sqlHash = computeSqlHash(normalized);
  const errors: string[] = [];

  // -------------------------------------------------------------------------
  // Bước 1: Kiểm tra biến runtime trên văn bản gốc (trước khi tách chuỗi '...')
  // -------------------------------------------------------------------------
  const placeholderMatches = normalized.match(/\{[a-zA-Z0-9_]+\}/g) ?? [];
  const detectedPlaceholders = Array.from(new Set(placeholderMatches));
  const allowedSet = new Set<string>(entry.allowedPlaceholders);

  const unexpectedPlaceholders = detectedPlaceholders.filter(
    (token) => !allowedSet.has(token),
  );
  const missingPlaceholders = entry.allowedPlaceholders.filter(
    (required) => !detectedPlaceholders.includes(required),
  );

  // Kiểm tra thêm trường hợp dấu ngoặc nhọn không hợp lệ (vd `{}` hoặc `{foo-bar}` hoặc ngoặc nhọn lẻ)
  const strippedValidTokens = normalized.replace(/\{[a-zA-Z0-9_]+\}/g, '');
  const hasMalformedBraces =
    strippedValidTokens.includes('{') || strippedValidTokens.includes('}');

  let placeholdersOk = true;
  if (unexpectedPlaceholders.length > 0) {
    placeholdersOk = false;
    errors.push(
      `Biến runtime không được phép trong câu "${entry.key}": ${unexpectedPlaceholders.join(', ')}. Chỉ cho phép: ${entry.allowedPlaceholders.join(', ')}`,
    );
  }
  if (missingPlaceholders.length > 0) {
    placeholdersOk = false;
    errors.push(
      `Thiếu biến runtime bắt buộc trong câu "${entry.key}": ${missingPlaceholders.join(', ')}`,
    );
  }
  if (hasMalformedBraces) {
    placeholdersOk = false;
    errors.push(
      'Cú pháp biến runtime dấu ngoặc nhọn {…} không hợp lệ hoặc chưa đóng ngoặc',
    );
  }

  // -------------------------------------------------------------------------
  // Bước 2: Bung biến mẫu và chạy State-Machine Lexer kiểm tra chỉ đọc
  // -------------------------------------------------------------------------
  const sampleExpanded = expandCatalogTemplate(normalized, {
    dateFrom: MONITOR_DEFAULT_DATE,
    brand: MONITOR_DEFAULT_BRAND,
  });
  const lexed = lexSql(sampleExpanded);

  let readOnlySelectOk = true;
  if (!normalized) {
    readOnlySelectOk = false;
    errors.push('Nội dung câu truy vấn SQL không được để trống');
  }
  if (lexed.hasUnclosedLiteralOrIdentifier) {
    readOnlySelectOk = false;
    errors.push(
      'Câu truy vấn có chuỗi ký tự (\'...\') hoặc định danh ("...") chưa đóng dấu nháy',
    );
  }
  if (lexed.hasComments) {
    readOnlySelectOk = false;
    errors.push(
      'Không được phép chứa chú thích SQL (-- hoặc /* */) trong câu truy vấn',
    );
  }

  const trimmedCleaned = lexed.cleanedSql.trim();
  if (trimmedCleaned && !/^(SELECT|WITH)\b/i.test(trimmedCleaned)) {
    readOnlySelectOk = false;
    errors.push('Câu truy vấn bắt buộc phải bắt đầu bằng SELECT hoặc WITH');
  }

  if (lexed.tokens.some((t) => t.type === 'semicolon') || trimmedCleaned.includes(';')) {
    readOnlySelectOk = false;
    errors.push(
      'Không được phép chứa dấu chấm phẩy (;) hoặc ghép nhiều câu lệnh SQL',
    );
  }

  const matchedForbidden: string[] = [];
  for (const token of lexed.tokens) {
    if (token.type === 'word' && FORBIDDEN_SQL_KEYWORDS[token.upper]) {
      if (!matchedForbidden.includes(token.upper)) {
        matchedForbidden.push(token.upper);
      }
    }
  }
  if (matchedForbidden.length > 0) {
    readOnlySelectOk = false;
    errors.push(
      `Phát hiện từ khóa SQL bị cấm trong truy vấn chỉ đọc: ${matchedForbidden.join(', ')}`,
    );
  }

  // -------------------------------------------------------------------------
  // Bước 3: Kiểm tra mọi định danh bảng sau FROM / JOIN phải thuộc maycha_live hoặc kbmd_live
  // -------------------------------------------------------------------------
  const referencedTables: string[] = [];
  const invalidTables: string[] = [];
  const tokens = lexed.tokens;

  for (let idx = 0; idx < tokens.length; idx++) {
    const token = tokens[idx]!;
    if (token.type !== 'word') {
      continue;
    }

    if (token.upper === 'FROM' || token.upper === 'JOIN') {
      let cursor = inspectTableTarget(
        tokens,
        idx + 1,
        referencedTables,
        invalidTables,
      );

      // Nếu là mệnh đề FROM (kể cả subquery mở ngoặc hay có JOIN xen giữa), quét tiếp comma-join ở độ sâu ngoặc 0
      if (token.upper === 'FROM') {
        let parenDepth = 0;
        while (cursor < tokens.length) {
          const cur = tokens[cursor]!;
          if (cur.type === 'lparen') {
            parenDepth++;
          } else if (cur.type === 'rparen') {
            if (parenDepth === 0) {
              break;
            }
            parenDepth--;
          } else if (parenDepth === 0) {
            if (cur.type === 'word' && FROM_CLAUSE_TERMINATORS[cur.upper]) {
              break;
            }
            if (cur.type === 'comma') {
              cursor = inspectTableTarget(
                tokens,
                cursor + 1,
                referencedTables,
                invalidTables,
              );
              continue;
            }
          }
          cursor++;
        }
      }
    }
  }

  const uniqueReferencedTables = Array.from(new Set(referencedTables));
  let allowedTablesOk = true;
  if (invalidTables.length > 0) {
    allowedTablesOk = false;
    errors.push(
      `Bảng truy vấn không hợp lệ hoặc nằm ngoài schema cho phép (chỉ chấp nhận ${SAP_SCHEMA_TTVH}.<Bảng> hoặc ${SAP_SCHEMA_KBMD}.<Bảng>): ${Array.from(new Set(invalidTables)).join(', ')}`,
    );
  } else if (uniqueReferencedTables.length === 0) {
    allowedTablesOk = false;
    errors.push(
      `Câu truy vấn phải tham chiếu ít nhất một bảng thuộc ${SAP_SCHEMA_TTVH} hoặc ${SAP_SCHEMA_KBMD}`,
    );
  }

  // -------------------------------------------------------------------------
  // Bước 4: Kiểm tra độ dài OPENQUERY ở kịch bản lô 300 PO (7 chữ số) <= 7800 ký tự
  // -------------------------------------------------------------------------
  const worstCaseExpanded = expandCatalogTemplate(normalized, {
    dateFrom: MONITOR_DEFAULT_DATE,
    brand: MONITOR_DEFAULT_BRAND,
    poNumbers: WORST_CASE_PO_NUMBERS,
  });
  const escapedInner = worstCaseExpanded.trim().replaceAll("'", "''");
  const worstCaseOpenQueryLength = escapedInner.length;
  let openQueryLengthOk = true;

  if (worstCaseOpenQueryLength > OPENQUERY_SAFE_MAX_LENGTH) {
    openQueryLengthOk = false;
    errors.push(
      `Độ dài câu truy vấn trong OPENQUERY khi chạy lô ${WORST_CASE_PO_BATCH_SIZE} PO là ${worstCaseOpenQueryLength} ký tự, vượt giới hạn an toàn ${OPENQUERY_SAFE_MAX_LENGTH} ký tự`,
    );
  } else {
    // Đảm bảo hàm renderCatalogSql chạy thành công với kịch bản 300 PO
    renderCatalogSql(normalized, {
      dateFrom: MONITOR_DEFAULT_DATE,
      brand: MONITOR_DEFAULT_BRAND,
      poNumbers: WORST_CASE_PO_NUMBERS,
    });
  }

  return {
    valid:
      placeholdersOk &&
      readOnlySelectOk &&
      allowedTablesOk &&
      openQueryLengthOk &&
      errors.length === 0,
    sqlHash,
    worstCaseOpenQueryLength,
    maxOpenQueryLength: OPENQUERY_SAFE_MAX_LENGTH,
    detectedPlaceholders,
    missingPlaceholders,
    unexpectedPlaceholders,
    referencedTables: uniqueReferencedTables,
    steps: {
      placeholdersOk,
      readOnlySelectOk,
      allowedTablesOk,
      openQueryLengthOk,
    },
    errors,
  };
}

/**
 * Đối chiếu danh sách cột và dữ liệu trả về thực tế từ SAP với Hợp đồng Cột của câu gốc (`v1`):
 * - `missingColumns`: các cột trong `entry.requiredColumns` bị thiếu.
 * - `extraColumns`: các cột mới thêm không nằm trong `entry.baselineColumns`.
 * - `duplicateKeyCount`: số dòng bị trùng khóa theo `entry.dedupKeys`.
 * - `semanticErrors`: lỗi trùng tên cột, thêm cột phụ vào câu có `supportsExtraColumns === false`,
 *   hoặc sai tiền tố `'Da den'` / `'Chua den'` của cột `Ghi chu ShipDate` trên câu `t2`/`t3`.
 */
export function compareQueryColumns(
  entry: SapQueryCatalogEntry,
  actualColumns: readonly string[],
  rows: readonly (readonly SapCellValue[])[],
): ColumnDiffResult {
  const actualSet = new Set(actualColumns);
  const requiredSet = new Set(entry.requiredColumns);
  const baselineSet = new Set(entry.baselineColumns);

  const missingColumns = entry.requiredColumns.filter(
    (col) => !actualSet.has(col),
  );

  const extraColumns: string[] = [];
  const duplicateColumnNames: string[] = [];
  const seenActual = new Set<string>();

  for (const col of actualColumns) {
    const trimmed = col.trim();
    if (!trimmed) {
      continue;
    }
    if (seenActual.has(col)) {
      if (!duplicateColumnNames.includes(col)) {
        duplicateColumnNames.push(col);
      }
    } else {
      seenActual.add(col);
    }
    if (!baselineSet.has(col) && !extraColumns.includes(col)) {
      extraColumns.push(col);
    }
  }

  const semanticErrors: string[] = [];
  const warnings: string[] = [];

  if (actualColumns.some((col) => !col || col.trim() === '')) {
    semanticErrors.push(
      'Tập kết quả có cột không có tên (cần đặt alias AS "Tên cột" tường minh)',
    );
  }

  if (duplicateColumnNames.length > 0) {
    semanticErrors.push(
      `Danh sách cột trả về có tên cột bị trùng lặp: ${duplicateColumnNames.join(', ')}`,
    );
  }

  if (!entry.supportsExtraColumns && extraColumns.length > 0) {
    semanticErrors.push(
      `Câu truy vấn "${entry.key}" không hỗ trợ thêm cột phụ (${extraColumns.join(', ')}). Vui lòng giữ nguyên danh sách cột chuẩn để không ảnh hưởng luồng ghép nội bộ.`,
    );
  }

  // Kiểm tra khóa khử trùng (dedupKeys)
  let duplicateKeyCount = 0;
  if (entry.dedupKeys.length > 0 && rows.length > 0) {
    const keyIndices = entry.dedupKeys.map((keyCol) =>
      actualColumns.indexOf(keyCol),
    );
    if (keyIndices.every((idx) => idx >= 0)) {
      const seenKeys = new Set<string>();
      for (const row of rows) {
        const compositeKey = keyIndices
          .map((idx) => JSON.stringify(row[idx] ?? null))
          .join('\u0000');
        if (seenKeys.has(compositeKey)) {
          duplicateKeyCount++;
        } else {
          seenKeys.add(compositeKey);
        }
      }
    }
  }

  if (duplicateKeyCount > 0) {
    warnings.push(
      `Phát hiện ${duplicateKeyCount} dòng bị trùng khóa định danh (${entry.dedupKeys.join(' + ')}). Kiểm tra lại điều kiện JOIN / GROUP BY / DISTINCT để tránh nhân bội chứng từ.`,
    );
  }

  // Kiểm tra ngữ nghĩa cột `Ghi chu ShipDate` trên câu t2 và t3
  if ((entry.key === 't2' || entry.key === 't3') && rows.length > 0) {
    const shipDateNoteIdx = actualColumns.indexOf('Ghi chu ShipDate');
    if (shipDateNoteIdx >= 0) {
      const invalidRowIdx = rows.findIndex((row) => {
        const val = String(row[shipDateNoteIdx] ?? '');
        return !val.startsWith('Da den') && !val.startsWith('Chua den');
      });
      if (invalidRowIdx >= 0) {
        const badValue = String(rows[invalidRowIdx]?.[shipDateNoteIdx] ?? '');
        semanticErrors.push(
          `Cột "Ghi chu ShipDate" tại dòng ${invalidRowIdx + 1} có giá trị "${badValue}" không bắt đầu bằng "Da den" hoặc "Chua den" (làm sai lệch bộ đếm KPI Treo quá hạn/chưa đến hạn).`,
        );
      }
    }
  }

  const columnChecks: SapQueryColumnCheckItem[] = [];
  for (const col of entry.requiredColumns) {
    columnChecks.push({
      columnName: col,
      kind: 'required',
      status: actualSet.has(col) ? 'present' : 'missing',
    });
  }
  for (const col of entry.baselineColumns) {
    if (!requiredSet.has(col)) {
      columnChecks.push({
        columnName: col,
        kind: 'baseline_optional',
        status: actualSet.has(col) ? 'present' : 'removed',
      });
    }
  }
  for (const col of extraColumns) {
    columnChecks.push({
      columnName: col,
      kind: 'extra',
      status: entry.supportsExtraColumns ? 'added' : 'unsupported_extra',
    });
  }

  return {
    valid: missingColumns.length === 0 && semanticErrors.length === 0,
    requiredColumns: [...entry.requiredColumns],
    baselineColumns: [...entry.baselineColumns],
    actualColumns: [...actualColumns],
    missingColumns,
    extraColumns,
    duplicateKeyCount,
    columnChecks,
    warnings,
    semanticErrors,
  };
}
