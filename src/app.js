const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const authRoutes = require('./routes/auth.routes');

const app = express();

// Global middleware in order
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "unpkg.com"          // for Lucide icons CDN used in views
            ],
            scriptSrcAttr: ["'none'"],
            styleSrc: ["'self'", "'unsafe-inline'"],   // unsafe-inline needed for EJS inline styles
            imgSrc: ["'self'", "data:", "res.cloudinary.com", "*.cloudinary.com"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'", "res.cloudinary.com"],
            frameSrc: ["'self'", "res.cloudinary.com"],  // for PDF preview iframes
            ...(env.NODE_ENV === 'production' ? { upgradeInsecureRequests: [] } : {})
        }
    },
    hsts: {
        maxAge: 31536000,           // 1 year in seconds
        includeSubDomains: true,
        preload: true
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginEmbedderPolicy: false   // must be false to allow Cloudinary media embeds
}));
app.use(cors({
    origin: env.APP_BASE_URL,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(env.COOKIE_SECRET));

// CSRF protection for view routes
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: { httpOnly: true, sameSite: 'strict' } });

// Morgan logging (only in non-test environments)
if (env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
}

// Global rate limiter
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 200,
    standardHeaders: true,
    legacyHeaders: false
}));

// Auth-specific rate limiter
const authLimiter = rateLimit({
    windowMs: 60 * 1000,  // 1 minute
    max: 10
});

// Mount routes
const authMiddleware = require('./middleware/auth.middleware');
const fileRoutes = require('./routes/file.routes');
const folderRoutes = require('./routes/folder.routes');
const userRoutes = require('./routes/user.routes');
const orgRoutes = require('./routes/org.routes');

app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/files', authMiddleware, fileRoutes);
app.use('/api/v1/folders', authMiddleware, folderRoutes);
app.use('/api/v1/users', authMiddleware, userRoutes);
app.use('/api/v1/org', authMiddleware, orgRoutes);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Mount frontend routes
const authViewRoutes = require('./routes/auth.view.routes');
const viewRoutes = require('./routes/view.routes');
const authRedirectMiddleware = require('./middleware/authRedirect.middleware');

app.use('/', authViewRoutes);
app.use('/', authRedirectMiddleware, csrfProtection, viewRoutes);

// Set up EJS view engine
app.set('views', path.join(__dirname, 'views'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'ejs');


// Global error handler
app.use((err, req, res, next) => {
    console.error(err);
    const status = err.status || err.statusCode || 500;
    const isApiRequest = req.path.startsWith('/api/');
    
    if (isApiRequest) {
        return res.status(status).json({
            success: false,
            message: err.message || 'Internal server error'
        });
    }
    
    // For browser requests, render an error page
    return res.status(status).render('error', {
        title: 'Error',
        statusCode: status,
        message: status === 404 ? 'Page not found' : 'Something went wrong',
        user: req.user || null,
        currentPath: req.path
    });
});

module.exports = app;