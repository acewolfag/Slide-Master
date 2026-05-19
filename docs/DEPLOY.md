# Deploy: Docker self-host + Coolify + Cloudflare Tunnel

Mục tiêu: chạy app trên 1 máy Linux ở nhà, expose ra internet qua Cloudflare Tunnel (không cần IP public, không port forward), tự deploy lại khi `git push main`.

> File này là sách hành động. Mỗi bước copy-paste là chạy được. Không skip thứ tự.

---

## 0. Yêu cầu trước

Trên máy server (Ubuntu/Debian khuyến nghị):

```bash
# Tối thiểu: 2 GB RAM, 20 GB disk, Docker 24+
sudo apt update && sudo apt install -y curl ca-certificates
docker --version || curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# log out + log in lại để áp group
```

Có sẵn:
- Domain riêng (DNS đã trỏ về Cloudflare — nameservers ở registrar).
- Tài khoản Cloudflare miễn phí.
- Tài khoản GitHub (repo `acewolfag/Slide-Master` đã có).
- Supabase project với `DATABASE_URL` (Session pooler, port 5432, sslmode=require).

---

## 1. Cài Coolify trên server

```bash
# 1 dòng — script chính thức từ coolify.io
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
```

Sau khi xong, mở `http://<server-ip>:8000` từ máy local (cùng LAN) → tạo tài khoản admin đầu tiên.

> **Không expose port 8000 ra internet.** Coolify UI chỉ truy cập qua LAN hoặc qua Tailscale/Cloudflare Access nếu muốn remote.

---

## 2. Tạo Cloudflare Tunnel

1. Vào **Cloudflare dashboard → Zero Trust → Networks → Tunnels → Create a tunnel**.
2. Chọn connector **Cloudflared**, đặt tên (ví dụ `slidemaster-home`).
3. Bước "Install connector": **copy chuỗi token** (dài, bắt đầu bằng `eyJ...`).
4. Bước "Public Hostnames":
   - Subdomain: để trống (= root) hoặc `www`.
   - Domain: chọn domain của bạn.
   - Service: `HTTP` + URL `app:8080`.
5. Save.

> Cloudflare sẽ tự tạo CNAME record `<tunnel-id>.cfargotunnel.com`. Không cần thao tác DNS bằng tay.

Cất token sang `CF_TUNNEL_TOKEN` (nhập vào Coolify ở bước 4).

---

## 3. Kết nối GitHub repo vào Coolify

1. Coolify UI → **Sources → Add new → GitHub App**.
2. Click "Register" → ủy quyền Coolify trên GitHub → chọn repo `acewolfag/Slide-Master` (hoặc "All repositories").
3. Quay về Coolify, source xanh là OK.

---

## 4. Tạo resource Docker Compose

1. Coolify UI → **Projects → New project → New resource → Docker Compose** (chọn source = GitHub App vừa setup).
2. Repository: `acewolfag/Slide-Master`, branch: `main`, base directory: `/`, compose file: `docker-compose.yml`.
3. Sang tab **Environment Variables**, nhập:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | từ Supabase (pooler, sslmode=require) |
   | `SESSION_SECRET` | sinh bằng `openssl rand -hex 32` |
   | `CORS_ORIGINS` | `https://yourdomain.com,https://www.yourdomain.com` |
   | `CF_TUNNEL_TOKEN` | token copy ở bước 2 |
   | `SEPAY_TOKEN`, `SMTP_*`, ... | nếu dùng |

4. Tab **General → Build Pack**: `Docker Compose`.
5. Tab **Webhooks**: bật **Auto Deploy** cho branch `main`. Coolify tự tạo webhook GitHub.
6. **Deploy** (nút xanh trên cùng) — lần đầu mất ~5–10 phút (build LibreOffice + pnpm install + Vite build).

---

## 5. Kiểm tra

Trên server:
```bash
docker compose ps   # cả 2 service đều "running healthy"
docker compose logs -f app
```

Trên trình duyệt:
- `https://yourdomain.com/` → frontend load
- `https://yourdomain.com/api/healthz` → `{"status":"ok"}`
- Thử login admin, upload archive, tạo template → confirm `/api/uploads/...` ảnh hiện đúng.

---

## 6. Workflow "ý tưởng mới"

Trên máy Windows:

```powershell
# Sửa code (Claude Code / editor)
git add .
git commit -m "feat: thêm filter sort theo giá"
git push origin main
```

Coolify nhận webhook → pull → `docker compose build` → `docker compose up -d` → web cập nhật trong ~2 phút.

Nếu deploy fail: Coolify UI → tab **Deployments** → xem log. Tự rollback bằng nút **Restart** trên deployment trước.

---

## 7. Backup uploads (quan trọng)

Uploads sống trong Docker named volume `uploads`. Backup mỗi tuần:

```bash
docker run --rm \
  -v $(docker volume ls -q | grep uploads):/from \
  -v /home/$USER/backups:/to \
  alpine tar czf /to/uploads-$(date +%F).tar.gz -C /from .
```

Hoặc cron job. Database thì Supabase tự backup.

---

## 8. Khi nào cần SSH vào server thẳng

- Update Coolify: `curl ... | bash` lại (script tự upgrade).
- Reset volume uploads (DANGER): `docker volume rm <name>`.
- Xem dung lượng: `docker system df`.

Tuyệt đối **không** sửa code trực tiếp trên server — luôn qua `git push`.

---

## 9. Troubleshooting

| Triệu chứng | Nguyên nhân | Cách sửa |
|---|---|---|
| Build fail `node-unrar-js` not found | esbuild externals nhưng prod install không cài | check stage 2 của Dockerfile có `pnpm install --prod --filter @workspace/api-server` |
| `/api/uploads/xxx.png` 404 | volume mount sai path | confirm `docker compose config` thấy mount `uploads:/app/artifacts/api-server/uploads` |
| LibreOffice timeout, no preview sinh ra | RAM < 1 GB | nâng RAM hoặc bỏ `pdf-to-png-converter`, dùng PNG đơn lẻ |
| Tunnel "Down" trong CF dashboard | token sai hoặc container `cloudflared` crash | `docker compose logs cloudflared` |
| Login 500, "SESSION_SECRET not provided" | env chưa nhập trong Coolify | thêm + redeploy |
| Browser cache CSS cũ sau deploy | Vite hash trong filename rồi — hard refresh Ctrl+Shift+R |

---

## 10. Chi phí dự kiến

| Thành phần | Chi phí |
|---|---|
| Server tại nhà (PC cũ) | $0 |
| Điện 24/7 (~30W) | ~50k₫/tháng |
| Cloudflare Tunnel | $0 |
| Cloudflare DNS | $0 |
| Domain (.com) | ~250k₫/năm |
| Supabase free tier | $0 (đến 500MB DB) |
| **Tổng** | **~50k₫/tháng + domain** |
