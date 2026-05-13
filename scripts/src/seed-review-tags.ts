// Seed default review criteria + moderation tags. Idempotent — ON CONFLICT
// DO NOTHING on the unique slug column means re-running is safe.
import { pool } from "@workspace/db";

const CRITERIA = [
  { slug: "design-quality", labelVi: "Thiết kế đẹp", labelEn: "Beautiful design", sortOrder: 10 },
  { slug: "easy-edit", labelVi: "Dễ chỉnh sửa", labelEn: "Easy to edit", sortOrder: 20 },
  { slug: "match-description", labelVi: "Đúng mô tả", labelEn: "Matches description", sortOrder: 30 },
  { slug: "good-value", labelVi: "Giá hợp lý", labelEn: "Good value", sortOrder: 40 },
  { slug: "complete-content", labelVi: "Nội dung đầy đủ", labelEn: "Complete content", sortOrder: 50 },
  { slug: "fast-delivery", labelVi: "Giao hàng nhanh", labelEn: "Fast delivery", sortOrder: 60 },
];

const MOD_TAGS = [
  { slug: "spam", labelVi: "Spam", color: "amber", sortOrder: 10 },
  { slug: "abusive", labelVi: "Xúc phạm", color: "red", sortOrder: 20 },
  { slug: "off-topic", labelVi: "Không liên quan", color: "slate", sortOrder: 30 },
  { slug: "fake", labelVi: "Đánh giá giả", color: "purple", sortOrder: 40 },
  { slug: "competitor-ad", labelVi: "Quảng cáo đối thủ", color: "orange", sortOrder: 50 },
];

async function main() {
  console.log("Seeding review_criteria...");
  for (const c of CRITERIA) {
    await pool.query(
      `INSERT INTO review_criteria (slug, label_vi, label_en, sort_order, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (slug) DO NOTHING`,
      [c.slug, c.labelVi, c.labelEn, c.sortOrder],
    );
  }

  console.log("Seeding review_moderation_tags...");
  for (const t of MOD_TAGS) {
    await pool.query(
      `INSERT INTO review_moderation_tags (slug, label_vi, color, sort_order, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (slug) DO NOTHING`,
      [t.slug, t.labelVi, t.color, t.sortOrder],
    );
  }

  const [{ rows: cr }, { rows: mt }] = await Promise.all([
    pool.query<{ count: string }>(`SELECT count(*) FROM review_criteria`),
    pool.query<{ count: string }>(`SELECT count(*) FROM review_moderation_tags`),
  ]);
  console.log(`Done. ${cr[0].count} criteria, ${mt[0].count} moderation tags.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
