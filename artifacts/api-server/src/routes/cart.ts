import { Router } from "express";
import { db } from "@workspace/db";
import { templatesTable, vouchersTable } from "@workspace/db";
import { eq, and, gte, gt } from "drizzle-orm";

const router = Router();

interface CartItem {
  templateId: number;
  titleVi: string;
  titleEn: string;
  price: number;
  thumbnailUrl: string;
}

interface CartSession {
  items: CartItem[];
  appliedVoucher: string | null;
  discount: number;
}

const carts: Map<string, CartSession> = new Map();

function getCartId(req: any): string {
  let cartId = req.headers["x-cart-id"] as string;
  if (!cartId) cartId = `cart-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return cartId;
}

function computeCart(cart: CartSession) {
  const subtotal = cart.items.reduce((s, i) => s + i.price, 0);
  const discount = cart.discount;
  const total = Math.max(0, subtotal - discount);
  return {
    items: cart.items,
    subtotal,
    discount,
    total,
    currency: "VND",
    appliedVoucher: cart.appliedVoucher,
  };
}

router.get("/cart", async (req, res): Promise<void> => {
  const cartId = getCartId(req);
  const cart = carts.get(cartId) ?? { items: [], appliedVoucher: null, discount: 0 };
  res.set("X-Cart-Id", cartId);
  res.json(computeCart(cart));
});

router.post("/cart/items", async (req, res): Promise<void> => {
  const cartId = getCartId(req);
  const { templateId } = req.body;
  if (!templateId) { res.status(400).json({ error: "templateId required" }); return; }

  const [template] = await db.select().from(templatesTable).where(eq(templatesTable.id, Number(templateId)));
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }

  const cart = carts.get(cartId) ?? { items: [], appliedVoucher: null, discount: 0 };
  const alreadyInCart = cart.items.some(i => i.templateId === Number(templateId));
  if (!alreadyInCart) {
    cart.items.push({
      templateId: template.id,
      titleVi: template.titleVi,
      titleEn: template.titleEn,
      price: parseFloat(String(template.price)),
      thumbnailUrl: template.thumbnailUrl,
    });
  }
  carts.set(cartId, cart);
  res.set("X-Cart-Id", cartId);
  res.json(computeCart(cart));
});

router.delete("/cart/items/:templateId", async (req, res): Promise<void> => {
  const cartId = getCartId(req);
  const raw = Array.isArray(req.params.templateId) ? req.params.templateId[0] : req.params.templateId;
  const templateId = parseInt(raw, 10);

  const cart = carts.get(cartId) ?? { items: [], appliedVoucher: null, discount: 0 };
  cart.items = cart.items.filter(i => i.templateId !== templateId);
  carts.set(cartId, cart);
  res.set("X-Cart-Id", cartId);
  res.json(computeCart(cart));
});

router.post("/cart/voucher", async (req, res): Promise<void> => {
  const cartId = getCartId(req);
  const { code } = req.body;
  if (!code) { res.status(400).json({ error: "Voucher code required" }); return; }

  const now = new Date();
  const [voucher] = await db.select().from(vouchersTable).where(
    and(eq(vouchersTable.code, code.toUpperCase()), eq(vouchersTable.isActive, true))
  );

  if (!voucher) { res.status(400).json({ error: "Mã giảm giá không hợp lệ" }); return; }
  if (voucher.expiresAt && voucher.expiresAt < now) { res.status(400).json({ error: "Mã giảm giá đã hết hạn" }); return; }
  if (voucher.usageCount >= voucher.usageLimit) { res.status(400).json({ error: "Mã giảm giá đã hết lượt dùng" }); return; }

  const cart = carts.get(cartId) ?? { items: [], appliedVoucher: null, discount: 0 };
  if (cart.items.length === 0) {
    res.status(400).json({ error: "Giỏ hàng trống — thêm sản phẩm trước khi áp mã giảm giá" });
    return;
  }
  const subtotal = cart.items.reduce((s, i) => s + i.price, 0);

  if (voucher.minOrderAmount && subtotal < parseFloat(String(voucher.minOrderAmount))) {
    const minVnd = parseFloat(String(voucher.minOrderAmount));
    res.status(400).json({ error: `Đơn hàng tối thiểu ${minVnd.toLocaleString("vi-VN")}đ để áp mã này` });
    return;
  }

  let discount = 0;
  if (voucher.discountType === "percentage") {
    discount = subtotal * (parseFloat(String(voucher.discountValue)) / 100);
  } else {
    discount = parseFloat(String(voucher.discountValue));
  }

  cart.appliedVoucher = code.toUpperCase();
  cart.discount = Math.min(discount, subtotal);
  carts.set(cartId, cart);
  res.set("X-Cart-Id", cartId);
  res.json(computeCart(cart));
});

export { carts, getCartId };
export default router;
