const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve the frontend UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Dynamic Proxy Route
app.use('/proxy', (req, res, next) => {
    let targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).send('Error: Missing target URL parameter.');
    }
    
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
    }

    try {
        createProxyMiddleware({
            target: targetUrl,
            changeOrigin: true,
            secure: false,
            xfwd: true,
            router: () => targetUrl,
            on: {
                proxyReq: (proxyReq, req, res) => {
                    // Remove security headers that block framing/embedding if needed
                },
                proxyRes: (proxyRes, req, res) => {
                    delete proxyRes.headers['x-frame-options'];
                    delete proxyRes.headers['content-security-policy'];
                }
            }
        })(req, res, next);
    } catch (err) {
        res.status(500).send('Proxy error: ' + err.message);
    }
});

app.listen(PORT, () => {
    console.log(`Proxy running on port ${PORT}`);
});