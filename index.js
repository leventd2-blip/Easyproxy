const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Advanced Proxy Route with Path & Redirect Rewriting
app.use('/proxy', (req, res, next) => {
    let rawUrl = req.query.url;
    if (!rawUrl) {
        return res.status(400).send(`
            <body style="background:#090d16;color:#f9fafb;font-family:sans-serif;text-align:center;padding-top:60px;">
                <h2 style="color:#ef4444;">⚠️ Missing Target URL</h2>
                <p>Please provide a valid website address to proxy.</p>
                <a href="/" style="color:#38bdf8;text-decoration:none;font-weight:bold;">← Return Home</a>
            </body>
        `);
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
        // Dynamically map the path and query string (e.g., /app or ?q=test)
        pathRewrite: () => parsedTarget.pathname + parsedTarget.search,
        on: {
            proxyReq: (proxyReq, req) => {
                proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
                proxyReq.setHeader('Accept-Language', 'en-US,en;q=0.9');
            },
            proxyRes: (proxyRes, req, res) => {
                // Strip restrictions that prevent framing or embedding
                delete proxyRes.headers['x-frame-options'];
                delete proxyRes.headers['content-security-policy'];
                delete proxyRes.headers['strict-transport-security'];

                // Rewrite redirect headers so users stay inside the proxy network
                if (proxyRes.headers['location']) {
                    let loc = proxyRes.headers['location'];
                    if (loc.startsWith('/')) {
                        loc = parsedTarget.origin + loc;
                    } else if (!loc.startsWith('http')) {
                        loc = parsedTarget.origin + '/' + loc;
                    }
                    proxyRes.headers['location'] = '/proxy?url=' + encodeURIComponent(loc);
                }
            },
            error: (err, req, res) => {
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'text/html' });
                }
                res.end(`
                    <body style="background:#090d16;color:#f9fafb;font-family:sans-serif;text-align:center;padding-top:60px;">
                        <h2 style="color:#ef4444;">❌ Connection Failed</h2>
                        <p>The target server refused the connection or blocked proxy routing.</p>
                        <pre style="color:#9ca3af;background:#111827;padding:12px;display:inline-block;border-radius:6px;font-size:0.9rem;">${err.message}</pre><br><br>
                        <a href="/" style="color:#38bdf8;text-decoration:none;font-weight:bold;">← Back to Proxy Portal</a>
                    </body>
                `);
            }
        }
    })(req, res, next);
});

app.listen(PORT, () => {
    console.log(`Enterprise Proxy Engine live on port ${PORT}`);
});
