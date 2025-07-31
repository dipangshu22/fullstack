const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    }
    
    // If it's an API request, return JSON error
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ 
            success: false, 
            message: 'Authentication required' 
        });
    }
    
    // For web requests, redirect to login
    const redirectUrl = req.originalUrl;
    res.redirect(`/auth/login?redirect=${encodeURIComponent(redirectUrl)}`);
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    
    if (req.path.startsWith('/api/')) {
        return res.status(403).json({ 
            success: false, 
            message: 'Admin access required' 
        });
    }
    
    res.status(403).render('error', {
        title: 'Access Denied',
        error: 'You do not have permission to access this page.'
    });
};

// Middleware to check if user is not authenticated (for login/register pages)
const isNotAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        return res.redirect('/account');
    }
    next();
};

// JWT token verification (for API endpoints)
const verifyToken = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'No token provided' 
            });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid token' 
            });
        }
        
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ 
            success: false, 
            message: 'Invalid token' 
        });
    }
};

// Optional authentication (doesn't require login but adds user if available)
const optionalAuth = async (req, res, next) => {
    if (req.session && req.session.user) {
        try {
            const user = await User.findById(req.session.user.id).select('-password');
            req.user = user;
        } catch (error) {
            console.error('Error loading user:', error);
        }
    }
    next();
};

module.exports = {
    isAuthenticated,
    isAdmin,
    isNotAuthenticated,
    verifyToken,
    optionalAuth
};