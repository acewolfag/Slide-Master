# PROJECT BRIEF: WEBSITE THƯƠNG MẠI ĐIỆN TỬ "2Grils.PPT"

> **Gửi:** Development Agent / Team
> **Người yêu cầu:** Chủ thương hiệu 2Grils.PPT
> **Ngày:** 2026
> **Loại dự án:** Website bán template PowerPoint + nhận đặt thiết kế custom
> **Timeline dự kiến:** 3–4 tháng
> **Thị trường:** Việt Nam (chính) + Quốc tế (phụ) — **đa ngôn ngữ Việt/Anh**

---

## 1. TỔNG QUAN DỰ ÁN (PROJECT OVERVIEW)

### 1.1 Mục tiêu kinh doanh
Xây dựng nền tảng thương mại điện tử chuyên bán **template PowerPoint kỹ thuật số** dưới thương hiệu **2Grils.PPT**, đồng thời nhận **đơn đặt hàng thiết kế PPT theo yêu cầu** (custom design service).

### 1.2 Đối tượng người dùng
- **B2C — Cá nhân:** sinh viên, giảng viên, freelancer cần slide thuyết trình.
- **B2B — Doanh nghiệp:** marketing team, startup cần pitch deck, công ty cần báo cáo.
- **Khách hàng quốc tế:** sử dụng tiếng Anh, thanh toán qua Stripe/PayPal (giai đoạn 2).

### 1.3 USP — Điểm khác biệt
- Template chất lượng cao, được phân loại theo ngành / mục đích sử dụng.
- **Dịch vụ Custom Design** — khách gửi yêu cầu, team báo giá, giao file.
- Hỗ trợ song ngữ Việt – Anh.
- Trải nghiệm mua hàng tối giản, hiện đại — phù hợp người Việt nhưng vẫn chuẩn quốc tế.

### 1.4 Branding (tham khảo logo đính kèm)
- **Tên thương hiệu:** 2Grils.PPT
- **Bảng màu chính:** gradient Xanh lá (#00B14F) → Xanh dương (#1E5FAF)
- **Phong cách:** hiện đại, trẻ trung, chuyên nghiệp, tối giản
- **Font gợi ý:** Inter, Manrope, hoặc Be Vietnam Pro (hỗ trợ tốt tiếng Việt)

---

## 2. YÊU CẦU CÔNG NGHỆ (TECH STACK)

### 2.1 Bắt buộc
| Lớp | Công nghệ đề xuất | Ghi chú |
|---|---|---|
| **Frontend** | Next.js 14+ (App Router), React 18, TypeScript | SEO-friendly, SSR/ISR |
| **Styling** | TailwindCSS + shadcn/ui | Component system nhất quán |
| **Backend** | Next.js Route Handlers / tRPC | Monolith trong giai đoạn đầu |
| **Database** | PostgreSQL (Supabase / Neon) | Quan hệ rõ ràng |
| **ORM** | Prisma | Type-safe |
| **Auth** | NextAuth.js / Auth.js | Email + Google + Facebook |
| **Storage** | Cloudflare R2 / AWS S3 | Lưu file .pptx, ảnh preview |
| **CDN** | Cloudflare | Tăng tốc giao file toàn cầu |
| **Email** | Resend / SendGrid | Gửi link tải, hóa đơn |
| **i18n** | next-intl | Việt / Anh |
| **Search** | Meilisearch / Algolia (hoặc PostgreSQL FTS) | Tìm kiếm template |
| **Hosting** | Vercel (frontend) + Railway/Supabase (DB) | Auto-scale |

### 2.2 Cổng thanh toán — **VietQR (ưu tiên duy nhất giai đoạn 1)**
- Tích hợp **VietQR** qua API ngân hàng (gợi ý: **Casso, SePay, hoặc PayOS**) để tự động đối soát giao dịch.
- Hệ thống **tự động xác nhận đơn hàng** khi nhận được tiền (qua webhook đối soát biến động số dư).
- Lưu QR động kèm nội dung chuyển khoản duy nhất cho mỗi đơn (VD: `2GRILS ORDxxxxx`).
- Có cơ chế **fallback thủ công**: nếu webhook lỗi, admin có thể xác nhận bằng tay trong dashboard.
- **Kiến trúc mở rộng:** thiết kế lớp Payment Gateway abstract để dễ tích hợp **Stripe/PayPal** ở giai đoạn 2 (phục vụ khách quốc tế).

---

## 3. CHỨC NĂNG CHI TIẾT (FEATURES)

### 3.1 Trang chủ (Homepage)
- Hero section: tagline + CTA "Khám phá template" / "Đặt thiết kế riêng".
- Section template **nổi bật** (featured), **mới nhất** (latest), **bán chạy** (best-seller).
- Section **danh mục** (categories) dạng grid hình ảnh.
- Section **đánh giá khách hàng** (testimonials/reviews carousel).
- Banner **dịch vụ Custom Design**.
- Footer: liên kết, mạng xã hội, đăng ký newsletter, thông tin doanh nghiệp.

### 3.2 Catalog & Phân loại sản phẩm
- **Trang danh mục** với filter sidebar:
  - Theo **danh mục** (Pitch Deck, Báo cáo, Giáo dục, Marketing, Sự kiện, Y tế, Tài chính…).
  - Theo **phong cách** (Minimal, Corporate, Creative, Dark, Colorful…).
  - Theo **giá** (Free / Premium / khoảng giá).
  - Theo **số slide**.
  - Theo **tỷ lệ khung** (16:9 / 4:3).
- **Sắp xếp:** mới nhất, bán chạy, giá tăng/giảm, đánh giá cao.
- **Tag system** — gắn tag linh hoạt cho từng sản phẩm.
- **Trang chi tiết sản phẩm** (Product Detail Page):
  - Slideshow ảnh preview (mỗi slide một ảnh).
  - **Demo PPTX nhúng** (xem trước vài slide qua iframe Office Online hoặc PDF preview).
  - Mô tả chi tiết, tính năng, danh sách slide, phần mềm tương thích.
  - Giá + nút **"Mua ngay"** + **"Thêm vào giỏ"**.
  - Tab **Đánh giá** (reviews + rating star).
  - Section **sản phẩm liên quan**.

### 3.3 Tìm kiếm
- Thanh tìm kiếm có **autocomplete / suggest** ở mọi trang.
- Hỗ trợ **tìm kiếm tiếng Việt có/không dấu**.
- Trang kết quả tìm kiếm có filter giống trang danh mục.

### 3.4 Giỏ hàng & Thanh toán (Cart & Checkout)
- **Cart icon** ở header (hiển thị số lượng).
- Trang giỏ hàng: liệt kê sản phẩm, số lượng (mặc định 1 vì là digital), nút xóa, **mã giảm giá**, tổng tiền (VND + USD switch).
- **Checkout flow** (1 trang, không bắt buộc tạo tài khoản — guest checkout):
  - Nhập thông tin: họ tên, email, SĐT, (xuất hóa đơn VAT — tùy chọn).
  - **Thanh toán bằng VietQR**:
    - Hiển thị mã QR động kèm nội dung CK duy nhất.
    - Đếm ngược thời hạn (15 phút).
    - Tự động nhận diện thanh toán → chuyển sang trang "Cảm ơn".
  - Sau thanh toán: gửi email **link tải file** (có thời hạn / số lần tải giới hạn).
- **Trang "Cảm ơn"** với link tải + hướng dẫn.

### 3.5 Tài khoản người dùng (User Dashboard)
- Đăng ký / Đăng nhập (Email + Google + Facebook).
- **Tủ của tôi** (My Library): danh sách sản phẩm đã mua, nút **Tải lại** không giới hạn.
- **Lịch sử đơn hàng**: trạng thái + hóa đơn.
- **Yêu cầu Custom Design** của tôi — trạng thái: chờ báo giá / đã báo giá / đang thực hiện / hoàn thành.
- **Wishlist** — sản phẩm yêu thích.
- Quản lý thông tin cá nhân, đổi mật khẩu.

### 3.6 Đánh giá & Nhận xét (Reviews)
- Chỉ khách **đã mua** mới được đánh giá (verified purchase badge).
- 5 sao + nội dung + (tùy chọn) ảnh slide đã sử dụng.
- Admin có thể duyệt / ẩn review xấu (spam/vi phạm), không được sửa nội dung review thật.
- Hiển thị **rating trung bình** + biểu đồ phân bố sao trên trang sản phẩm.

### 3.7 ⭐ DỊCH VỤ CUSTOM DESIGN (Đặt thiết kế theo yêu cầu)

> **Đây là tính năng KHÁC BIỆT — cần thiết kế UX rất kỹ.**

#### 3.7.1 Trang giới thiệu dịch vụ
- Mô tả quy trình 4 bước: **Gửi yêu cầu → Báo giá → Thiết kế → Bàn giao**.
- Bảng giá tham khảo (theo số slide, độ phức tạp).
- Portfolio các dự án custom đã thực hiện.
- FAQ.
- Nút lớn **"Gửi yêu cầu ngay"**.

#### 3.7.2 Form gửi yêu cầu (Custom Brief Form)
Form đa bước (multi-step) gồm:
- **Bước 1 — Thông tin cơ bản:** Họ tên, email, SĐT, công ty (tùy chọn).
- **Bước 2 — Chủ đề & Mục đích:** loại slide (Pitch deck / Báo cáo / Giảng dạy / Sự kiện…), đối tượng người xem, mục tiêu.
- **Bước 3 — Yêu cầu thiết kế:**
  - Số lượng slide (số/khoảng).
  - Phong cách mong muốn (chọn từ thư viện mẫu hoặc upload reference).
  - Bảng màu / logo công ty (upload).
  - Tỷ lệ khung (16:9 / 4:3).
  - Ngôn ngữ (Việt / Anh / khác).
- **Bước 4 — Nội dung & Deadline:**
  - Upload file nội dung (Word, PDF, link Google Drive).
  - Deadline mong muốn.
  - Ngân sách dự kiến (khoảng giá hoặc "cần tư vấn").
  - Ghi chú thêm.
- **Bước 5 — Xác nhận & Gửi:** review lại + gửi.

Sau khi gửi:
- Tạo **Request ID** duy nhất (VD: `CUSTOM-2026-0001`).
- Gửi email xác nhận cho khách + thông báo cho admin (Telegram/Slack webhook).
- Tự động tạo entry trong dashboard admin.

#### 3.7.3 Quy trình admin xử lý yêu cầu
- Admin xem chi tiết yêu cầu → soạn báo giá → gửi qua hệ thống (khách nhận email + xem trong dashboard).
- Khách **chấp nhận / từ chối / thương lượng** (chat in-app đơn giản).
- Khi chấp nhận: thanh toán **đặt cọc 50%** qua VietQR.
- Trạng thái dự án: `Pending → Quoted → Deposit Paid → In Progress → Review → Final Payment → Delivered`.
- Hệ thống **chat realtime đơn giản** giữa admin và khách (gợi ý dùng Pusher / Supabase Realtime).
- Khách xem **bản nháp** + comment → thanh toán nốt 50% → nhận file final.

### 3.8 Hệ thống Voucher / Mã giảm giá
- Admin tạo mã: % giảm hoặc số tiền cố định.
- Điều kiện: đơn tối thiểu, ngày hết hạn, số lượt sử dụng, áp dụng cho danh mục cụ thể.
- Mã chào mừng cho user mới (tự động tạo khi đăng ký).

### 3.9 Trang Blog / Tài nguyên (Resources)
- Bài viết: hướng dẫn dùng PPT, tips thuyết trình, case study.
- SEO-friendly (URL đẹp, sitemap, schema.org).
- Có thể dùng **MDX** hoặc **Sanity/Strapi** làm CMS.

### 3.10 Đa ngôn ngữ (i18n)
- 2 ngôn ngữ: **Tiếng Việt (mặc định)** + **Tiếng Anh**.
- URL pattern: `/vi/...` và `/en/...`.
- Switcher ở header.
- Tất cả nội dung sản phẩm có cả 2 phiên bản (admin nhập song song).

---

## 4. ADMIN DASHBOARD (CMS)

Trang quản trị riêng tại `/admin` — chỉ tài khoản role `ADMIN` truy cập:

### 4.1 Dashboard tổng quan
- Doanh thu (ngày / tuần / tháng / năm) — biểu đồ.
- Số đơn hàng, số yêu cầu custom đang chờ.
- Top sản phẩm bán chạy.
- Khách hàng mới.

### 4.2 Quản lý sản phẩm
- CRUD template: upload file `.pptx`, ảnh preview, mô tả (Việt/Anh), giá, danh mục, tag, trạng thái (active/draft).
- Bulk upload, bulk edit.
- Tự động sinh ảnh preview từ `.pptx` (dùng LibreOffice headless hoặc service như Aspose).

### 4.3 Quản lý đơn hàng
- Danh sách đơn, filter theo trạng thái / ngày / khách hàng.
- Chi tiết đơn + lịch sử thanh toán.
- Xác nhận thủ công (fallback khi webhook VietQR lỗi).
- Xuất hóa đơn PDF.

### 4.4 Quản lý yêu cầu Custom Design
- Inbox dạng kanban: `Mới → Đang báo giá → Đã chấp nhận → Đang làm → Hoàn thành`.
- Chi tiết từng yêu cầu, chat với khách, upload file nháp / final.

### 4.5 Quản lý người dùng
- Danh sách user, phân quyền (Customer / Admin / Designer).
- Xem lịch sử mua hàng từng user.

### 4.6 Quản lý nội dung
- Blog post, banner trang chủ, voucher, danh mục, FAQ.

### 4.7 Báo cáo & Xuất dữ liệu
- Xuất CSV/Excel doanh thu, đơn hàng, danh sách khách.
- Tích hợp Google Analytics 4 + Facebook Pixel.

---

## 5. YÊU CẦU PHI CHỨC NĂNG (NON-FUNCTIONAL)

### 5.1 Hiệu năng
- **Lighthouse Score ≥ 90** (Performance, SEO, Accessibility).
- **LCP < 2.5s**, **CLS < 0.1**.
- Lazy loading ảnh, ISR cho trang sản phẩm, edge caching.

### 5.2 SEO
- URL semantic: `/template/pitch-deck-startup-2026`.
- Meta tags + Open Graph + Twitter Card đầy đủ.
- Schema.org: `Product`, `Review`, `BreadcrumbList`, `Organization`.
- Sitemap.xml tự động + robots.txt.
- Hỗ trợ song ngữ với `hreflang`.

### 5.3 Bảo mật
- HTTPS bắt buộc, HSTS.
- Rate limiting cho API (Upstash Redis).
- CSRF protection, input validation (Zod).
- Mật khẩu hash với bcrypt/argon2.
- File `.pptx` trên storage **không public** — chỉ truy cập qua **signed URL** hết hạn sau 24h.
- Mỗi link tải có giới hạn **5 lần / 30 ngày** (chống share bừa).
- 2FA cho tài khoản admin.

### 5.4 Responsive & Accessibility
- Mobile-first, hỗ trợ tốt từ 360px → 4K.
- WCAG 2.1 AA: contrast, keyboard nav, ARIA, alt text.

### 5.5 Pháp lý (quan trọng tại VN)
- Trang **Điều khoản sử dụng** và **Chính sách bảo mật** (PDPA/GDPR-aware).
- **Bản quyền template:** ghi rõ license (cá nhân / thương mại).
- **Chính sách hoàn tiền** cho sản phẩm số.
- Cookie consent banner (khi có user EU).
- Thông tin doanh nghiệp ở footer (theo Nghị định 52/2013).

---

## 6. CẤU TRÚC URL ĐỀ XUẤT

```
/                              # Homepage
/templates                     # Catalog
/templates/[category]          # Theo danh mục
/template/[slug]               # Chi tiết sản phẩm
/search?q=...                  # Kết quả tìm kiếm
/cart                          # Giỏ hàng
/checkout                      # Thanh toán
/order/[orderId]/success       # Trang cảm ơn
/custom-design                 # Giới thiệu dịch vụ custom
/custom-design/new             # Form gửi yêu cầu
/account                       # Dashboard user
/account/library               # Tủ của tôi
/account/orders                # Đơn hàng
/account/custom-requests       # Yêu cầu custom
/blog                          # Blog
/blog/[slug]                   # Bài viết
/about, /contact, /faq, /terms, /privacy
/admin/*                       # CMS
```

---

## 7. PHẠM VI BÀN GIAO (DELIVERABLES)

1. **Mã nguồn** trên GitHub (private repo) — code clean, comment đầy đủ, có README.
2. **Tài liệu kỹ thuật:** kiến trúc, ERD database, API spec (OpenAPI/Postman).
3. **Tài liệu sử dụng** cho admin (Việt + Anh).
4. **Triển khai production** trên Vercel + DB managed.
5. **Domain + SSL** đã cấu hình.
6. **Hệ thống email** đã setup (DKIM, SPF, DMARC).
7. **Hỗ trợ bảo trì** 30 ngày sau bàn giao (sửa bug miễn phí).
8. **Training** cho admin sử dụng CMS (1–2 buổi online).

---

## 8. ROADMAP ĐỀ XUẤT (3–4 THÁNG)

| Giai đoạn | Thời gian | Nội dung chính |
|---|---|---|
| **Phase 0 — Discovery** | Tuần 1 | Wireframe, design system, ERD, brief chi tiết |
| **Phase 1 — Design** | Tuần 2–3 | UI/UX Figma toàn bộ trang, duyệt design |
| **Phase 2 — Core E-commerce** | Tuần 4–8 | Catalog, cart, checkout, VietQR, user account, library, email |
| **Phase 3 — Custom Design Module** | Tuần 9–11 | Form yêu cầu, chat, kanban admin, deposit flow |
| **Phase 4 — CMS & Admin** | Tuần 11–13 | Dashboard, quản lý sản phẩm/đơn/user, báo cáo |
| **Phase 5 — i18n, SEO, Polish** | Tuần 14–15 | Đa ngôn ngữ, SEO, performance, accessibility |
| **Phase 6 — Testing & Launch** | Tuần 16 | QA, UAT, deploy production, training |

---

## 9. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

- ✅ Toàn bộ chức năng hoạt động đúng theo brief, không có bug critical/high.
- ✅ Thanh toán VietQR đối soát tự động chính xác **≥ 99%**.
- ✅ Lighthouse Performance ≥ 90 trên cả mobile & desktop.
- ✅ Test trên Chrome, Safari, Firefox, Edge — Win/Mac/iOS/Android.
- ✅ Đầy đủ 2 ngôn ngữ Việt/Anh.
- ✅ Backup database tự động hằng ngày.
- ✅ Có monitoring (Sentry / LogRocket).
- ✅ Tài liệu đầy đủ và admin được training.

---

## 10. THÔNG TIN BỔ SUNG CẦN AGENT XÁC NHẬN

Trước khi bắt tay vào làm, vui lòng phản hồi các câu hỏi sau:

1. Đề xuất stack cuối cùng (xác nhận hoặc đề xuất thay thế kèm lý do).
2. Báo giá chi tiết cho từng phase + tổng dự án.
3. Mock-up UI sample 2–3 trang chính (Home, Product Detail, Custom Form) trước khi build.
4. Đội ngũ thực hiện (PM, Designer, FE, BE, QA) + thời gian commit.
5. Quy trình bàn giao mã nguồn + sở hữu trí tuệ.
6. Phương án scale khi traffic tăng (ví dụ chiến dịch marketing lớn).

---

**Hết brief. Mong nhận được phản hồi trong 5–7 ngày làm việc.**

*Mọi thắc mắc xin liên hệ qua email/Zalo của chủ dự án.*
