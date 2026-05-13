# Deploy Checklist — 2Grils.PPT

Hoàn thành tất cả mục dưới đây trước khi go-live production.

## 1. Bảo mật đã fix

CRITICAL & HIGH issues đã được xử lý:

- CORS allowlist (`CORS_ORIGINS` env) — không còn open CORS
- Helmet security headers (HSTS, X-Frame-Options, X-Content-Type, …)
- Rate limiting trên `/auth/login`, `/auth/reset-password`, `/admin/users/*/send-reset-link`, `/upload-attachment`
- Zip slip path traversal — sanitize cả zip + rar entries qua `safeTargetPath`
- Plaintext password trong email — đã đổi thành generic notification
- Auth + ownership check trên `/custom-requests/:id` (GET, pay-deposit, pay-final, approve-demo)
- Idempotency cho pay-deposit/pay-final (return existing pending order)
- Order code collision (`Date.now() last 6` → thêm 4 hex random)
- Order code regex `[0-9A-F]+` — match cả hex random suffix (fix critical: trước đó regex `\d+` làm 85% giao dịch không tự đối soát được)
- Dashboard SQL fix: `AT TIME ZONE 'Asia/Ho_Chi_Minh'` literal (Postgres không bind param cho clause này)
- Timing-safe password compare (`crypto.timingSafeEqual`)
- POST `/upload` require Bearer auth; guest dùng `/upload-attachment` rate-limited
- HTML escape trong tất cả email templates
- Status whitelist trong PATCH `/admin/custom-requests/:id/status`
- Dashboard timezone (Asia/Ho_Chi_Minh) — chart đã match SQL grouping
- Dashboard N+1 query → `inArray` batch
- SePay poller backoff + per-tx checkpoint advance + log alerts khi liên tục fail
- SVG bị loại khỏi allowed mime (XSS vector)
- Body size limit (5 MB) cho JSON/urlencoded
- `crypto.randomBytes` cho generateRequestId (thay Math.random)
- **M1 Token signed**: HMAC-SHA256 với SESSION_SECRET. Format `<base64url-payload>.<hex-hmac>`. Token cũ không có dấu chấm sẽ bị reject — user re-login sau deploy.
- **M2 avatarUrl validate**: chỉ chấp nhận `/api/uploads/...` hoặc HTTPS từ allowlist (unsplash, googleusercontent, githubusercontent, hoặc env `AVATAR_URL_ALLOWED_HOSTS`)
- **M3 GET /api/settings filtered**: chỉ trả các key public (banner, hero, social, footer, contact, seo, homepage, pricing_visibility, announcement). Internal keys như `sepay_last_seen_tx_id` không leak.
- **M4 Reset token timing-safe**: fetch all unused unexpired candidates → `crypto.timingSafeEqual` không break sớm. Loại timing oracle.
- **M5 Frontend code-split**: bundle giảm từ 1.46MB monolith → 663 KB initial + lazy chunks. Admin pages + recharts chỉ tải khi vào `/admin/*`.
- **Health endpoint** có cả `/api/healthz` và `/api/health` (alias)

## 2. Environment variables — bắt buộc

```bash
# DB
DATABASE_URL=postgresql://...                    # Supabase / RDS / Cloud SQL

# Session
SESSION_SECRET=<crypto.randomBytes(32).toString('hex')>  # 32+ random bytes

# Ports
API_PORT=8080
PORT=5173        # Vite, distinct from API_PORT
BASE_PATH=/

# NODE
NODE_ENV=production

# CORS — bắt buộc set ở production
CORS_ORIGINS=https://2grils.com,https://www.2grils.com
TRUST_PROXY=1    # số hop reverse proxy

# Public base URL — dùng trong email reset-link và email confirmation
PUBLIC_BASE_URL=https://2grils.com

# SePay
SEPAY_API_KEY=<webhook api key, header "Apikey ...">
SEPAY_USER_API_TOKEN=<user access token, header "Bearer ...">
SEPAY_BANK_CODE=MB
SEPAY_ACCOUNT_NUMBER=...
SEPAY_ACCOUNT_NAME="2GRILS PPT"
SEPAY_POLL_INTERVAL_MS=30000
SEPAY_POLL_LIMIT=20

# SMTP — không cấu hình thì email confirmation/reset không gửi (silent skip với warn log)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM="2Grils.PPT <no-reply@2grils.com>"

# Rate limits (optional, có default)
RATE_LIMIT_LOGIN_PER_15MIN=10
RATE_LIMIT_RESET_PER_HOUR=5

# LibreOffice cho template archive upload (optional)
SOFFICE_PATH=/usr/bin/soffice    # hoặc Windows: C:\Program Files\LibreOffice\program\soffice.exe
```

## 3. Infrastructure

- [ ] HTTPS termination ở load balancer / reverse proxy (app không enforce HTTPS)
- [ ] Reverse proxy phải set `X-Forwarded-For` (express-rate-limit dùng)
- [ ] Postgres: tạo DB, set `DATABASE_URL`, chạy `pnpm --filter @workspace/db run push`
- [ ] Backup tự động cho DB
- [ ] Mount volume cho `artifacts/api-server/uploads/` (file PDF/PPTX/thumb persistent giữa restart)
- [ ] Static frontend build (`pnpm --filter @workspace/2grils-ppt run build` → `dist/public/`) serve qua CDN/nginx
- [ ] **LibreOffice** cài trên server nếu cần auto-thumbnail/PDF từ archive upload (optional)

## 4. SePay setup

- [ ] Tạo **API Key** webhook (my.sepay.vn → Webhook) → set `SEPAY_API_KEY`
- [ ] Tạo **User API Token** (my.sepay.vn → Access Tokens) → set `SEPAY_USER_API_TOKEN` (token KHÁC với webhook key)
- [ ] Cấu hình webhook URL trong SePay dashboard: `https://2grils.com/api/webhooks/sepay`
- [ ] Test webhook: dashboard SePay có nút "Test webhook"
- [ ] Test polling: tạo order → chuyển khoản → kiểm tra log `SePay poll: order auto-paid`

## 5. Build & deploy

```bash
# 1. Install
pnpm install --frozen-lockfile

# 2. Codegen + typecheck libs
pnpm run typecheck:libs
pnpm --filter @workspace/api-spec run codegen

# 3. Build
pnpm --filter @workspace/api-server run build         # → artifacts/api-server/dist/
pnpm --filter @workspace/2grils-ppt run build         # → artifacts/2grils-ppt/dist/public/

# 4. Push DB schema (one-time per env)
pnpm --filter @workspace/db run push

# 5. Run
pnpm --filter @workspace/api-server run start         # node dist/index.mjs
# Frontend: serve dist/public/ qua nginx hoặc CDN
```

## 6. Smoke test sau deploy

- [ ] `GET /api/healthz` (hoặc alias `/api/health`) → 200 `{"status":"ok"}`
- [ ] `GET /api/payment-info` → trả bank info đúng
- [ ] Tạo tài khoản test, đăng nhập, kiểm tra `lastLoginAt` trong DB
- [ ] Mua template, kiểm tra QR đúng bank/STK, chuyển khoản test, đợi 30s → status `paid`
- [ ] Gửi custom-request, admin báo giá, khách trả cọc, kiểm tra status `deposit-paid` tự nhảy
- [ ] Admin tạo voucher, toggle active/inactive
- [ ] Admin search user, send reset link → kiểm tra email + click link → đặt lại password
- [ ] Admin upload archive .zip chứa pptx → list extract đúng + thumbnail (nếu có LibreOffice)
- [ ] Dashboard hiện doanh thu thật + pie chart
- [ ] Kiểm tra log `SePay poller started` ngay khi server start

## 7. Issues còn lại (post-deploy)

Tất cả M1–M5 đã được xử lý (xem mục 1). Không còn issue tồn đọng nào trước deploy.

> Note: Token signed bằng HMAC vẫn ngắn hơn JWT chuẩn về metadata (không có alg/typ header). Nếu sau này cần interop với hệ thống khác (ví dụ partner API), nên migrate sang JWT signed (RS256/HS256). Hiện tại HMAC-SHA256 đủ mạnh cho first-party authentication.

## 8. Monitoring / alerting

- [ ] Tail log `pino` để filter `level: "error"` và `level: "fatal"`
- [ ] Alert khi `"SePay poll has failed N consecutive ticks"` xuất hiện
- [ ] Alert khi `Confirmation email failed` lặp nhiều lần (SMTP down)
- [ ] Health endpoint `/api/healthz` (hoặc alias `/api/health`) cho uptime monitoring
- [ ] Log retention tối thiểu 30 ngày để debug payment disputes

## 9. Rollback plan

- Build artifacts immutable theo version (Docker image hoặc tarball)
- DB schema thay đổi nhỏ (chỉ thêm cột, không drop) → rollback chỉ cần redeploy version cũ
- Không có schema breaking change → có thể rollback bất kỳ thời điểm nào
