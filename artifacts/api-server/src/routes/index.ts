import { Router, type IRouter } from "express";
import healthRouter from "./health";
import videosRouter from "./videos";
import usersRouter from "./users";
import genresRouter from "./genres";
import subscriptionRouter from "./subscription";
import statsRouter from "./stats";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(videosRouter);
router.use(usersRouter);
router.use(genresRouter);
router.use(subscriptionRouter);
router.use(statsRouter);
router.use(storageRouter);

export default router;
