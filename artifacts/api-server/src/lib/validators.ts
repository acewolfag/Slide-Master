/**
 * Input validators for customer-facing fields. Reject inputs that look like
 * HTML/script payloads and enforce reasonable length limits.
 */

const HTML_DANGER_RE = /[<>]/;
const NULL_BYTE_RE = /\x00/;
const CRLF_RE = /[\r\n]/;

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

export function validateCustomerName(input: unknown): ValidationResult {
  if (typeof input !== "string") return { ok: false, error: "Tên là bắt buộc" };
  const s = input.trim();
  if (s.length === 0) return { ok: false, error: "Tên không được để trống" };
  if (s.length > 100) return { ok: false, error: "Tên tối đa 100 ký tự" };
  if (HTML_DANGER_RE.test(s)) return { ok: false, error: "Tên không được chứa ký tự < hoặc >" };
  if (NULL_BYTE_RE.test(s) || CRLF_RE.test(s)) return { ok: false, error: "Tên không được chứa ký tự đặc biệt" };
  return { ok: true };
}

export function validateEmail(input: unknown): ValidationResult {
  if (typeof input !== "string") return { ok: false, error: "Email là bắt buộc" };
  const s = input.trim();
  if (s.length === 0) return { ok: false, error: "Email không được để trống" };
  if (s.length > 254) return { ok: false, error: "Email quá dài" };
  const re = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
  if (!re.test(s)) return { ok: false, error: "Email không hợp lệ" };
  if (CRLF_RE.test(s) || NULL_BYTE_RE.test(s)) return { ok: false, error: "Email chứa ký tự không hợp lệ" };
  return { ok: true };
}

export function validatePhone(input: unknown, required = false): ValidationResult {
  if (input === null || input === undefined || input === "") {
    return required ? { ok: false, error: "SĐT là bắt buộc" } : { ok: true };
  }
  if (typeof input !== "string") return { ok: false, error: "SĐT không hợp lệ" };
  const s = input.trim();
  if (s.length > 20) return { ok: false, error: "SĐT tối đa 20 ký tự" };
  if (!/^[+0-9\s\-().]+$/.test(s)) return { ok: false, error: "SĐT chỉ chứa chữ số, dấu +, -, ()" };
  return { ok: true };
}

export function validateText(
  input: unknown,
  opts: { maxLength?: number; required?: boolean; fieldName?: string } = {},
): ValidationResult {
  const { maxLength = 2000, required = false, fieldName = "Nội dung" } = opts;
  if (input === null || input === undefined || input === "") {
    return required ? { ok: false, error: `${fieldName} là bắt buộc` } : { ok: true };
  }
  if (typeof input !== "string") return { ok: false, error: `${fieldName} không hợp lệ` };
  if (input.length > maxLength) return { ok: false, error: `${fieldName} tối đa ${maxLength} ký tự` };
  if (HTML_DANGER_RE.test(input)) return { ok: false, error: `${fieldName} không được chứa ký tự < hoặc >` };
  if (NULL_BYTE_RE.test(input)) return { ok: false, error: `${fieldName} chứa ký tự không hợp lệ` };
  return { ok: true };
}

export function validateAll(...results: ValidationResult[]): ValidationResult {
  for (const r of results) {
    if (!r.ok) return r;
  }
  return { ok: true };
}
