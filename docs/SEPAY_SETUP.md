# SePay setup

Hướng dẫn setup SePay (cổng thanh toán VietQR auto-reconciliation) cho dự án.

## 1. Tổng quan luồng

```
User checkout -> POST /api/orders                  (status: pending, sinh QR SePay)
                |
User chuyển khoản đúng nội dung "2GRILS ORDxxxxxx"
                |
Bank thông báo SePay
                |
SePay POST -> /api/webhooks/sepay  (Authorization: Apikey ...)
                |
Server: match transferContent -> orders.transferContent
        kiểm tra amount >= total
        UPDATE orders SET status='paid', paid_at=now(), sepay_transaction_id=...
        UPDATE vouchers SET usage_count = usage_count + 1   (nếu có voucherCode)
        sendEmail()                                          (nếu SMTP_HOST set)
                |
FE polling /api/orders/:id/payment-status thấy paid -> hiển thị nút download
```

## 2. Biến môi trường (`.env` ở root)

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `SEPAY_API_KEY` | yes | API key trong dashboard SePay (giống ô "Apikey" khi cấu hình webhook) |
| `SEPAY_BANK_CODE` | yes | Bank code (VCB, MB, TCB, ACB, BIDV, TPB, VPB, STB, OCB, ...) |
| `SEPAY_ACCOUNT_NUMBER` | yes | Số tài khoản nhận tiền |
| `SEPAY_ACCOUNT_NAME` | yes | Tên chủ tài khoản (không dấu) |
| `SEPAY_MERCHANT_ID` | no | Merchant ID, log only |
| `PUBLIC_BASE_URL` | no | URL public của API (ngrok hoặc domain) - dùng để render link trong email |
| `SMTP_HOST` | no | Để trống nếu chưa cần email - `sendEmail()` sẽ no-op |

Nếu `SEPAY_*` thiếu, server sẽ fallback về QR placeholder (`api.vietqr.io`) nhưng webhook trả 503 - sẽ không có order nào được mark paid.

## 3. Setup ngrok cho local development

SePay cần URL public để gọi webhook. Local `localhost:8080` không reach được từ internet -> dùng ngrok tunnel.

### Cài đặt

```powershell
# Option A: Chocolatey
choco install ngrok

# Option B: Tải binary từ https://ngrok.com/download và bỏ vào PATH

# Đăng ký tài khoản free tại https://dashboard.ngrok.com -> lấy authtoken
ngrok config add-authtoken <YOUR_AUTHTOKEN>
```

### Chạy tunnel

```powershell
ngrok http 8080
```

Output:
```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:8080
```

Copy URL `https://abc123.ngrok-free.app` (đổi mỗi lần restart ngrok với gói free).

Cập nhật `.env`:
```
PUBLIC_BASE_URL=https://abc123.ngrok-free.app
```

Restart api-server để load `PUBLIC_BASE_URL` mới.

## 4. Cấu hình webhook trên SePay dashboard

1. Vào https://my.sepay.vn -> **Cấu hình -> Cấu hình webhooks**
2. Thêm webhook mới:
   - **URL:** `https://abc123.ngrok-free.app/api/webhooks/sepay`
   - **Method:** `POST`
   - **Authentication:** `Apikey`
   - **Apikey:** giá trị `SEPAY_API_KEY` trong `.env`
   - **Content-Type:** `application/json`
3. Liên kết tài khoản ngân hàng tại **Cấu hình -> Tài khoản ngân hàng**. Số tài khoản này phải khớp `SEPAY_ACCOUNT_NUMBER`.
4. Lưu lại.

## 5. Test webhook

### Test với SePay sandbox (nếu có)

Dashboard SePay có nút "Gửi webhook test" - nó POST một payload giả lập tới URL của bạn.

### Test với curl (offline, không cần ngrok)

```bash
curl -X POST http://localhost:8080/api/webhooks/sepay \
  -H "Authorization: Apikey $SEPAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 12345,
    "gateway": "VCB",
    "transactionDate": "2025-01-15 10:30:00",
    "accountNumber": "1234567890",
    "code": null,
    "content": "2GRILS ORD123456 chuyen khoan",
    "transferType": "in",
    "transferAmount": 99000,
    "accumulated": 0,
    "subAccount": null,
    "referenceCode": "FT00000000",
    "description": "Chuyen khoan"
  }'
```

Tạo order trước (qua frontend hoặc curl), copy `transferContent` (ví dụ `2GRILS ORD123456`) và đặt vào trường `content` của payload trên cùng số tiền `transferAmount` >= `total` của order.

Response thành công:
```json
{ "ok": true, "orderId": 1, "status": "paid", "idempotent": false }
```

### Test mà không cần SePay (manual mark-paid cho dev)

Endpoint admin sẵn có:
```
POST /api/admin/orders/:id/confirm
Authorization: Bearer <admin-token>
```

Đăng nhập admin (`admin@2grils.com / admin123`), lấy token từ `localStorage.auth_token`, rồi:
```bash
curl -X POST http://localhost:8080/api/admin/orders/1/confirm \
  -H "Authorization: Bearer <admin-token>"
```

Endpoint này gọi cùng `markOrderPaid()` như webhook, nên đầy đủ side effects (voucher++, email).

## 6. Kiểm tra logs

Server log sẽ in:
- `Order paid` - webhook xử lý thành công
- `SePay tx already processed` - idempotency hit (re-delivery)
- `SePay tx matched no order` - content không khớp order nào
- `SePay transfer amount short of order total` - chuyển thiếu tiền (cảnh báo, không mark paid)
- `SePay webhook auth failed` - Apikey sai

## 7. Production checklist

- [ ] `PUBLIC_BASE_URL` = domain thật của API
- [ ] `SEPAY_API_KEY` đã đặt trên SePay dashboard
- [ ] Webhook URL trên SePay = `https://api.yourdomain.com/api/webhooks/sepay`
- [ ] SMTP cấu hình xong (Gmail App Password / SendGrid / Resend)
- [ ] HTTPS-only (TLS terminator: Caddy/Nginx/Cloudflare)
- [ ] Backend đã handle `expiresAt` cho pending orders (đã có sẵn)
- [ ] Drizzle schema đã `push` lên DB production: 2 cột `sepay_transaction_id` + `webhook_received_at`
