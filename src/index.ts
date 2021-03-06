import express from "express";
import rateLimit from "express-rate-limit";
import { readFile } from "fs/promises";
import http from "http";
import https from "https";
import path from "path";
import { getFilesRoute } from "./modules/getFiles";

export const CDN = express();

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: "Too many requests to the CDN. Please try again later.",
});
(async () => {
  CDN.use(limiter);

  if (process.env.NODE_ENV === "production") {
    CDN.get("*", (req, res, next) => {
      if (req.secure) {
        next();
      } else {
        res.redirect(`https://` + req.headers.host + req.url);
      }
    });
  }

  CDN.use("/content", express.static(path.join(__dirname + "/assets")));

  CDN.get("/", (_, res) => {
    res.sendFile(path.join(__dirname + "/pages/index.html"));
  });

  CDN.get("/files", getFilesRoute);

  CDN.use("/*", (_, res) => {
    res.sendFile(path.join(__dirname + "/pages/404.html"));
  });

  const httpServer = http.createServer(CDN);

  const httpPort = process.env.NODE_ENV === "production" ? 80 : 8080;

  httpServer.listen(httpPort, () => {
    console.log(`http server listening on port ${httpPort}`);
  });

  if (process.env.NODE_ENV === "production") {
    const privateKey = await readFile(
      "/etc/letsencrypt/live/cdn.nhcarrigan.com/privkey.pem",
      "utf8"
    );
    const certificate = await readFile(
      "/etc/letsencrypt/live/cdn.nhcarrigan.com/cert.pem",
      "utf8"
    );
    const ca = await readFile(
      "/etc/letsencrypt/live/cdn.nhcarrigan.com/chain.pem",
      "utf8"
    );

    const credentials = {
      key: privateKey,
      cert: certificate,
      ca: ca,
    };

    const httpsServer = https.createServer(credentials, CDN);
    httpsServer.listen(443, () => {
      console.log("https server listening on port 443");
    });
  }
})();
