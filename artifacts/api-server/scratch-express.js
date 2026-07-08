import express from "express";
import { clerkMiddleware } from "@clerk/express";

const app = express();
app.use(clerkMiddleware());

app.get("/test", (req, res) => {
  console.log("req.auth.userId (without calling):", req.auth.userId);
  console.log("req.auth().userId (with calling):", req.auth().userId);
  res.send("ok");
});

import supertest from "supertest";
await supertest(app).get("/test");
