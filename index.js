const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.use('/proxy', (req, res, next) => {
    let rawUrl = req.query.url;
    if (!rawUrl) {
        return res.status(400).send('Missing target URL.');
    }

    if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
        rawUrl = 'https://' + rawUrl;
    }

    let parsedTarget;
    try {
        parsedTarget = new URL(rawUrl);
    } catch (err) {
        return res.status(400).send('Invalid URL format.');
    }

    createProxyMiddleware({
        target: parsedTarget.origin,
        changeOrigin: true,
        secure: false,
        xfwd: true,
        pathRewrite: () => parsedTarget.pathname + parsedTarget.search,
        on: {
            proxyReq: (proxyReq) => {
                proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
            },
            proxyRes: (proxyRes, req, res) => {
                delete proxyRes.headers['x-frame-options'];
                delete proxyRes.headers['content-security-policy'];
                delete proxyRes.headers['strict-transport-security'];

                if (proxyRes.headers['location']) {
                    let loc = proxyRes.headers['location'];
                    if (loc.startsWith('/')) {
                        loc = parsedTarget.origin + loc;
                    } else if (!loc.startsWith('http')) {
                        loc = parsedTarget.origin + '/' + loc;
                    }
                    proxyRes.headers['location'] = '/proxy?url=' + encodeURIComponent(loc);
                }

                // Rewrite HTML content response bodies to fix broken relative assets
                let ctype = proxyRes.headers['content-type'] || '';
                if (ctype.includes('text/html')) {
                    const originalWrite = res.write;
                    const originalEnd = res.end;
                    let chunks = [];

                    res.write = function (chunk) {
                        if (chunk) chunks.push(Buffer.from(chunk));
                    };

                    res.end = function (chunk) {
                        if (chunk) chunks.push(Buffer.from(chunk));
                        let body = Buffer.concat(chunks).toString('utf8');

                        // Rewrite links, scripts, and stylesheets pointing to absolute paths
                        const baseProxyPrefix = `/proxy?url=${encodeURIComponent(parsedTarget.origin)}`;
                        body = body.replace(/(href|src|action)=["'](\/[^"']*)["']/g, (match, attr, path) => {
                            return `${attr}="${baseProxyPrefix}${path}"`;
                        });

                        res.setHeader('content-length', Buffer.byteLength(body));
                        originalWrite.call(res, body);
                        originalEnd.call(res);
                    };
                }
            },
            error: (err, req, res) => {
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'text/html' });
                }
                res.end(`
                    <body style="background:#000;color:#fff;font-family:sans-serif;text-align:center;padding-top:60px;">
                        <h2>Proxy Routing Error</h2>
                        <p>${err.message}</p>
                        <a href="/" style="color:#38bdf8;">Return Home</a>
                    </body>
                `);
            }
        }
    })(req, res, next);
});

app.listen(PORT, () => {
    console.log(`Enterprise Gateway active on port ${PORT}`);
});
