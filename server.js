const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = 8080;
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

http.createServer((request, response) => {
  const requestedPath = decodeURIComponent(request.url.split("?")[0]);
  const filePath = path.resolve(root, `.${requestedPath === "/" ? "/index.html" : requestedPath}`);
  if (!filePath.startsWith(root + path.sep)) {
    response.writeHead(403);
    response.end("Keelatud");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500);
      response.end("Faili ei leitud");
      return;
    }
    response.writeHead(200, { "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream" });
    response.end(data);
  });
}).listen(port, () => {
  console.log(`Rakendus töötab aadressil http://localhost:${port}/index.html`);
});
