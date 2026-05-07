import { db } from "@workspace/db";
import {
  categoriesTable,
  templatesTable,
  reviewsTable,
  usersTable,
  blogPostsTable,
  vouchersTable,
  customRequestsTable,
  servicePricingTable,
} from "@workspace/db";
import crypto from "crypto";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + (process.env.SESSION_SECRET ?? "secret")).digest("hex");
}

async function seed() {
  console.log("Seeding database...");

  // Categories
  const cats = await db.insert(categoriesTable).values([
    { nameVi: "Pitch Deck", nameEn: "Pitch Deck", slug: "pitch-deck", icon: "Presentation", templateCount: 12 },
    { nameVi: "Báo cáo", nameEn: "Report", slug: "bao-cao", icon: "FileBarChart", templateCount: 8 },
    { nameVi: "Giáo dục", nameEn: "Education", slug: "giao-duc", icon: "GraduationCap", templateCount: 10 },
    { nameVi: "Marketing", nameEn: "Marketing", slug: "marketing", icon: "Megaphone", templateCount: 9 },
    { nameVi: "Sự kiện", nameEn: "Event", slug: "su-kien", icon: "CalendarDays", templateCount: 6 },
    { nameVi: "Y tế", nameEn: "Healthcare", slug: "y-te", icon: "HeartPulse", templateCount: 5 },
    { nameVi: "Tài chính", nameEn: "Finance", slug: "tai-chinh", icon: "TrendingUp", templateCount: 7 },
    { nameVi: "Công nghệ", nameEn: "Technology", slug: "cong-nghe", icon: "Cpu", templateCount: 11 },
  ]).returning().onConflictDoNothing();

  const catMap: Record<string, number> = {};
  for (const c of cats) catMap[c.slug] = c.id;

  // If categories already existed, fetch them
  if (cats.length === 0) {
    const existing = await db.select().from(categoriesTable);
    for (const c of existing) catMap[c.slug] = c.id;
  }

  // Templates
  const thumbnails = [
    "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600&h=400&fit=crop",
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=400&fit=crop",
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=400&fit=crop",
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=400&fit=crop",
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&h=400&fit=crop",
    "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=600&h=400&fit=crop",
    "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&h=400&fit=crop",
    "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=600&h=400&fit=crop",
    "https://images.unsplash.com/photo-1532619675605-1ede6c2ed2b0?w=600&h=400&fit=crop",
    "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&h=400&fit=crop",
  ];

  const pitchId = catMap["pitch-deck"] ?? 1;
  const marketingId = catMap["marketing"] ?? 4;
  const eduId = catMap["giao-duc"] ?? 3;
  const reportId = catMap["bao-cao"] ?? 2;
  const techId = catMap["cong-nghe"] ?? 8;
  const finId = catMap["tai-chinh"] ?? 7;

  await db.insert(templatesTable).values([
    {
      titleVi: "Startup Pitch Deck 2025 – Gradient Pro",
      titleEn: "Startup Pitch Deck 2025 – Gradient Pro",
      slug: "startup-pitch-deck-2025-gradient-pro",
      price: "199000",
      thumbnailUrl: thumbnails[0],
      previewImages: thumbnails.slice(0, 4),
      slideCount: 35,
      aspectRatio: "16:9",
      categoryId: pitchId,
      style: "Creative",
      tags: ["startup", "pitch", "gradient", "modern"],
      descriptionVi: "Template pitch deck chuyên nghiệp dành cho startup. Thiết kế gradient hiện đại, 35 slide đầy đủ từ vấn đề đến roadmap.",
      descriptionEn: "Professional pitch deck template for startups. Modern gradient design with 35 slides covering problem to roadmap.",
      features: ["35 slide đầy đủ", "Màu sắc tùy chỉnh", "Icon và infographic", "Font Be Vietnam Pro"],
      isFeatured: true,
      isBestSeller: true,
      avgRating: "4.8",
      reviewCount: 47,
      salesCount: 234,
    },
    {
      titleVi: "Corporate Annual Report – Minimal Blue",
      titleEn: "Corporate Annual Report – Minimal Blue",
      slug: "corporate-annual-report-minimal-blue",
      price: "149000",
      thumbnailUrl: thumbnails[1],
      previewImages: thumbnails.slice(1, 5),
      slideCount: 28,
      aspectRatio: "16:9",
      categoryId: reportId,
      style: "Minimal",
      tags: ["báo cáo", "corporate", "minimal", "blue"],
      descriptionVi: "Template báo cáo thường niên doanh nghiệp. Thiết kế tối giản với tông màu xanh chuyên nghiệp.",
      descriptionEn: "Corporate annual report template. Minimal design with professional blue tones.",
      features: ["28 slide", "Data visualization", "Charts & graphs", "Print-ready"],
      isFeatured: true,
      isBestSeller: false,
      avgRating: "4.6",
      reviewCount: 23,
      salesCount: 156,
    },
    {
      titleVi: "Marketing Campaign – Colorful Pop",
      titleEn: "Marketing Campaign – Colorful Pop",
      slug: "marketing-campaign-colorful-pop",
      price: "179000",
      thumbnailUrl: thumbnails[2],
      previewImages: thumbnails.slice(2, 6),
      slideCount: 30,
      aspectRatio: "16:9",
      categoryId: marketingId,
      style: "Colorful",
      tags: ["marketing", "colorful", "campaign", "social"],
      descriptionVi: "Template marketing sôi động với màu sắc tươi sáng. Phù hợp cho campaign quảng cáo và social media.",
      descriptionEn: "Vibrant marketing template with bright colors. Perfect for ad campaigns and social media.",
      features: ["30 slide", "Social media ready", "Animation hints", "Brand kit included"],
      isFeatured: false,
      isBestSeller: true,
      avgRating: "4.9",
      reviewCount: 68,
      salesCount: 312,
    },
    {
      titleVi: "Education – Giáo án điện tử Trẻ em",
      titleEn: "Kids Education – Interactive Lesson Plan",
      slug: "kids-education-interactive-lesson",
      price: "99000",
      thumbnailUrl: thumbnails[3],
      previewImages: thumbnails.slice(3, 7),
      slideCount: 40,
      aspectRatio: "16:9",
      categoryId: eduId,
      style: "Colorful",
      tags: ["giáo dục", "trẻ em", "interactive", "colorful"],
      descriptionVi: "Template giáo án điện tử sinh động dành cho trẻ em. Màu sắc tươi sáng, hình ảnh minh họa vui nhộn.",
      descriptionEn: "Lively digital lesson plan template for children. Bright colors and fun illustrations.",
      features: ["40 slide", "Kid-friendly design", "Activity slides", "Quiz templates"],
      isFeatured: true,
      isBestSeller: false,
      avgRating: "4.7",
      reviewCount: 31,
      salesCount: 189,
    },
    {
      titleVi: "Tech Product Launch – Dark Mode",
      titleEn: "Tech Product Launch – Dark Mode",
      slug: "tech-product-launch-dark-mode",
      price: "249000",
      thumbnailUrl: thumbnails[4],
      previewImages: thumbnails.slice(4, 8),
      slideCount: 32,
      aspectRatio: "16:9",
      categoryId: techId,
      style: "Dark",
      tags: ["tech", "dark", "product launch", "modern"],
      descriptionVi: "Template ra mắt sản phẩm công nghệ với dark mode ấn tượng. Thiết kế hiện đại, chuyên nghiệp.",
      descriptionEn: "Tech product launch template with stunning dark mode. Modern, professional design.",
      features: ["32 slide", "Dark & light version", "Device mockups", "Neon accents"],
      isFeatured: true,
      isBestSeller: true,
      avgRating: "5.0",
      reviewCount: 52,
      salesCount: 278,
    },
    {
      titleVi: "Finance Report – Clean Green",
      titleEn: "Finance Report – Clean Green",
      slug: "finance-report-clean-green",
      price: "169000",
      thumbnailUrl: thumbnails[5],
      previewImages: thumbnails.slice(5, 9),
      slideCount: 25,
      aspectRatio: "16:9",
      categoryId: finId,
      style: "Corporate",
      tags: ["tài chính", "finance", "green", "corporate"],
      descriptionVi: "Template báo cáo tài chính sạch sẽ, chuyên nghiệp. Màu xanh lá mang lại cảm giác tin tưởng.",
      descriptionEn: "Clean and professional financial report template. Green color conveys trust.",
      features: ["25 slide", "Financial charts", "KPI dashboards", "Excel compatible"],
      isFeatured: false,
      isBestSeller: false,
      avgRating: "4.5",
      reviewCount: 18,
      salesCount: 121,
    },
    {
      titleVi: "Free Starter – Business Essentials",
      titleEn: "Free Starter – Business Essentials",
      slug: "free-starter-business-essentials",
      price: "0",
      isFree: true,
      thumbnailUrl: thumbnails[6],
      previewImages: thumbnails.slice(6, 10),
      slideCount: 15,
      aspectRatio: "16:9",
      categoryId: reportId,
      style: "Minimal",
      tags: ["free", "business", "starter", "minimal"],
      descriptionVi: "Template miễn phí dành cho người mới bắt đầu. 15 slide cơ bản đầy đủ cho bài thuyết trình.",
      descriptionEn: "Free template for beginners. 15 essential slides for any presentation.",
      features: ["15 slide", "Free forever", "Easy to edit", "Basic layouts"],
      isFeatured: false,
      isBestSeller: false,
      avgRating: "4.2",
      reviewCount: 89,
      salesCount: 1240,
    },
    {
      titleVi: "Event Planning – Luxury Gold",
      titleEn: "Event Planning – Luxury Gold",
      slug: "event-planning-luxury-gold",
      price: "219000",
      thumbnailUrl: thumbnails[7],
      previewImages: thumbnails.slice(7, 10),
      slideCount: 22,
      aspectRatio: "16:9",
      categoryId: catMap["su-kien"] ?? 5,
      style: "Creative",
      tags: ["event", "luxury", "gold", "wedding"],
      descriptionVi: "Template sự kiện sang trọng với tông màu vàng gold. Phù hợp cho hội nghị, tiệc cưới, gala.",
      descriptionEn: "Luxurious event template with gold tones. Perfect for conferences, weddings, and galas.",
      features: ["22 slide", "Gold accent design", "Timeline slides", "Venue layout"],
      isFeatured: false,
      isBestSeller: true,
      avgRating: "4.8",
      reviewCount: 41,
      salesCount: 203,
    },
  ]).onConflictDoNothing();

  // Admin user
  await db.insert(usersTable).values({
    name: "Admin 2Grils",
    email: "admin@2grils.com",
    passwordHash: hashPassword("admin123"),
    role: "admin",
  }).onConflictDoNothing();

  // Demo customer
  const [demoUser] = await db.insert(usersTable).values({
    name: "Nguyễn Văn A",
    email: "demo@example.com",
    passwordHash: hashPassword("demo123"),
    role: "customer",
  }).returning().onConflictDoNothing();

  // Reviews
  const allTemplates = await db.select().from(templatesTable).limit(3);
  if (allTemplates.length > 0) {
    await db.insert(reviewsTable).values([
      {
        templateId: allTemplates[0].id,
        authorName: "Trần Minh Đức",
        rating: 5,
        comment: "Template rất đẹp, thiết kế chuyên nghiệp. Mình dùng để pitch cho nhà đầu tư và được khen ngợi nhiều lắm!",
        isVerifiedPurchase: true,
        isHidden: false,
      },
      {
        templateId: allTemplates[0].id,
        authorName: "Lê Thị Hoa",
        rating: 4,
        comment: "Slide rất đẹp và dễ chỉnh sửa. Chỉ tiếc là chưa có phiên bản 4:3.",
        isVerifiedPurchase: true,
        isHidden: false,
      },
      {
        templateId: allTemplates[0].id,
        authorName: "Phạm Quốc Bảo",
        rating: 5,
        comment: "Worth every penny! Thiết kế hiện đại, font chữ đẹp, màu sắc hài hòa.",
        isVerifiedPurchase: true,
        isHidden: false,
      },
    ]).onConflictDoNothing();
  }

  // Vouchers
  await db.insert(vouchersTable).values([
    {
      code: "WELCOME20",
      discountType: "percentage",
      discountValue: "20",
      usageLimit: 1000,
      isActive: true,
    },
    {
      code: "SALE50K",
      discountType: "fixed",
      discountValue: "50000",
      minOrderAmount: "150000",
      usageLimit: 500,
      isActive: true,
    },
  ]).onConflictDoNothing();

  // Blog posts
  await db.insert(blogPostsTable).values([
    {
      slug: "10-tips-thuyet-trinh-hieu-qua",
      titleVi: "10 Mẹo Thuyết Trình Hiệu Quả Mà Bạn Cần Biết",
      titleEn: "10 Effective Presentation Tips You Need to Know",
      excerptVi: "Thuyết trình tốt không chỉ là nội dung hay — đây là những bí quyết giúp bạn gây ấn tượng mạnh.",
      excerptEn: "A great presentation isn't just about content — here are tips to make a strong impression.",
      contentVi: "## 1. Chuẩn bị kỹ nội dung\nNội dung là vua. Hãy dành thời gian nghiên cứu và sắp xếp ý tưởng rõ ràng trước khi thiết kế slide.\n\n## 2. Sử dụng ảnh chất lượng cao\nẢnh đẹp tạo ấn tượng tốt. Sử dụng các trang như Unsplash hay Pexels để tìm ảnh miễn phí.",
      contentEn: "## 1. Prepare your content thoroughly\nContent is king. Spend time researching and organizing your ideas clearly before designing slides.\n\n## 2. Use high-quality images\nGreat images make a great impression. Use sites like Unsplash or Pexels for free high-quality photos.",
      coverImageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=400&fit=crop",
      author: "Team 2Grils.PPT",
      tags: ["thuyết trình", "tips", "powerpoint"],
    },
    {
      slug: "huong-dan-su-dung-powerpoint-co-ban",
      titleVi: "Hướng Dẫn Sử Dụng PowerPoint Từ A Đến Z",
      titleEn: "Complete PowerPoint Guide from A to Z",
      excerptVi: "Bài hướng dẫn toàn diện về PowerPoint dành cho người mới bắt đầu đến nâng cao.",
      excerptEn: "Comprehensive PowerPoint guide for beginners to advanced users.",
      contentVi: "## Làm quen với giao diện\nPowerPoint có giao diện ribbon quen thuộc. Các tab chính bao gồm Home, Insert, Design, Transitions, Animations và Slide Show.",
      contentEn: "## Getting familiar with the interface\nPowerPoint features a familiar ribbon interface. Main tabs include Home, Insert, Design, Transitions, Animations and Slide Show.",
      coverImageUrl: "https://images.unsplash.com/photo-1416339684178-3a239570f315?w=800&h=400&fit=crop",
      author: "Team 2Grils.PPT",
      tags: ["powerpoint", "hướng dẫn", "beginner"],
    },
    {
      slug: "case-study-pitch-deck-duoc-dau-tu",
      titleVi: "Case Study: Pitch Deck Giúp Startup Gọi Vốn 2 Triệu USD",
      titleEn: "Case Study: Pitch Deck That Helped Startup Raise $2M",
      excerptVi: "Câu chuyện thực tế về một startup Việt Nam sử dụng template 2Grils.PPT để gọi vốn thành công.",
      excerptEn: "A real story of a Vietnamese startup using 2Grils.PPT template to successfully raise funding.",
      contentVi: "## Bối cảnh\nStartup fintech XYZ cần gọi vốn Series A. Họ đã sử dụng template Startup Pitch Deck của 2Grils.PPT và tùy chỉnh theo thương hiệu của mình.",
      contentEn: "## Background\nFintech startup XYZ needed to raise Series A funding. They used 2Grils.PPT's Startup Pitch Deck template and customized it to their brand.",
      coverImageUrl: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&h=400&fit=crop",
      author: "Team 2Grils.PPT",
      tags: ["case study", "startup", "pitch deck", "fundraising"],
    },
  ]).onConflictDoNothing();

  // Custom request sample
  await db.insert(customRequestsTable).values({
    requestId: "CUSTOM-2026-0001",
    customerName: "Công ty ABC",
    customerEmail: "contact@abc.com",
    slideType: "Pitch Deck",
    slideCount: 20,
    deadline: "2026-06-01",
    language: "vi",
    status: "in-progress",
    style: "Corporate",
    budget: "3000000-5000000",
    quotedPrice: "4500000",
    notes: "Cần thiết kế pitch deck cho vòng gọi vốn Series A",
  }).onConflictDoNothing();

  // Service Pricing
  await db.insert(servicePricingTable).values([
    {
      name: "Cơ bản", nameEn: "Basic", slides: "10–15 slides",
      price: "1500000", deliveryDays: 3, revisions: "2 lần",
      features: ["1 phong cách thiết kế", "Font & màu theo yêu cầu", "File PPTX gốc", "Hỗ trợ 15 ngày"],
      featuresEn: ["1 design style", "Custom font & colors", "Original PPTX file", "15-day support"],
      isHighlight: false, isActive: true, sortOrder: 1,
    },
    {
      name: "Chuyên nghiệp", nameEn: "Professional", slides: "16–30 slides",
      price: "3500000", deliveryDays: 5, revisions: "3 lần",
      features: ["2 phong cách đề xuất", "Infographic & icon tùy chỉnh", "Animation cơ bản", "File PPTX + PDF", "Hỗ trợ 30 ngày"],
      featuresEn: ["2 proposed styles", "Custom infographic & icons", "Basic animations", "PPTX + PDF files", "30-day support"],
      isHighlight: true, isActive: true, sortOrder: 2,
    },
    {
      name: "Premium", nameEn: "Premium", slides: "31–50 slides",
      price: "7000000", deliveryDays: 7, revisions: "Không giới hạn",
      features: ["Tư vấn thương hiệu", "Motion graphics nâng cao", "Tất cả định dạng file", "Hỗ trợ trình bày trực tiếp", "Hỗ trợ 60 ngày"],
      featuresEn: ["Brand consulting", "Advanced motion graphics", "All file formats", "Live presentation support", "60-day support"],
      isHighlight: false, isActive: true, sortOrder: 3,
    },
  ]).onConflictDoNothing();

  console.log("Seeding complete!");
}

seed().catch(console.error);
