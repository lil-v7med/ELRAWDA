import jwt from 'jsonwebtoken';
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET environment variable must be set in production!");
    process.exit(1);
}
export const JWT_SECRET = process.env.JWT_SECRET || 'elrawda_secure_wealth_token_key_2026';
export function authMiddleware(req, res, next) {
    let token = req.cookies?.token;
    if (!token && req.headers.authorization) {
        const authHeader = req.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
    }
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: Session missing or expired' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (err) {
        return res.status(401).json({ error: 'Unauthorized: Session invalid or expired' });
    }
}
export function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    next();
}
