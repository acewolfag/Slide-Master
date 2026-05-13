import { Router, type IRouter } from "express";
import healthRouter from "./health";
import templatesRouter from "./templates";
import categoriesRouter from "./categories";
import authRouter from "./auth";
import cartRouter from "./cart";
import ordersRouter from "./orders";
import wishlistRouter from "./wishlist";
import customRequestsRouter from "./custom-requests";
import blogRouter from "./blog";
import adminRouter from "./admin";
import uploadRouter from "./upload";
import pricingRouter from "./pricing";
import webhooksRouter from "./webhooks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(uploadRouter);
router.use(pricingRouter);
router.use(authRouter);
router.use(cartRouter);
router.use(ordersRouter);
router.use(wishlistRouter);
router.use(customRequestsRouter);
router.use(blogRouter);
router.use(adminRouter);
router.use(categoriesRouter);
router.use(templatesRouter);
router.use(webhooksRouter);

export default router;
