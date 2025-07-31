const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { isNotAuthenticated, isAuthenticated } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const registerValidation = [
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('confirmPassword').custom((value, { req }) => {
        if (value !== req.body.password) {
            throw new Error('Passwords do not match');
        }
        return true;
    })
];

const loginValidation = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
];

// Register page
router.get('/register', isNotAuthenticated, (req, res) => {
    res.render('auth/register', {
        title: 'Register - Fashion Store',
        errors: [],
        formData: {}
    });
});

// Register user
router.post('/register', isNotAuthenticated, registerValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
            return res.render('auth/register', {
                title: 'Register - Fashion Store',
                errors: errors.array(),
                formData: req.body
            });
        }
        
        const { firstName, lastName, email, password } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render('auth/register', {
                title: 'Register - Fashion Store',
                errors: [{ msg: 'Email already registered' }],
                formData: req.body
            });
        }
        
        // Create new user
        const user = new User({
            firstName,
            lastName,
            email,
            password
        });
        
        await user.save();
        
        // Set session
        req.session.user = {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role
        };
        
        res.redirect('/account');
        
    } catch (error) {
        console.error('Registration error:', error);
        res.render('auth/register', {
            title: 'Register - Fashion Store',
            errors: [{ msg: 'Registration failed. Please try again.' }],
            formData: req.body
        });
    }
});

// Login page
router.get('/login', isNotAuthenticated, (req, res) => {
    const redirectUrl = req.query.redirect || '/account';
    res.render('auth/login', {
        title: 'Login - Fashion Store',
        errors: [],
        formData: {},
        redirectUrl
    });
});

// Login user
router.post('/login', isNotAuthenticated, loginValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        const redirectUrl = req.body.redirectUrl || '/account';
        
        if (!errors.isEmpty()) {
            return res.render('auth/login', {
                title: 'Login - Fashion Store',
                errors: errors.array(),
                formData: req.body,
                redirectUrl
            });
        }
        
        const { email, password } = req.body;
        
        // Find user
        const user = await User.findOne({ email, isActive: true });
        if (!user) {
            return res.render('auth/login', {
                title: 'Login - Fashion Store',
                errors: [{ msg: 'Invalid email or password' }],
                formData: req.body,
                redirectUrl
            });
        }
        
        // Check password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.render('auth/login', {
                title: 'Login - Fashion Store',
                errors: [{ msg: 'Invalid email or password' }],
                formData: req.body,
                redirectUrl
            });
        }
        
        // Set session
        req.session.user = {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role
        };
        
        // Update cart count if user has items in cart
        req.session.cartCount = user.cart.length;
        
        res.redirect(redirectUrl);
        
    } catch (error) {
        console.error('Login error:', error);
        const redirectUrl = req.body.redirectUrl || '/account';
        res.render('auth/login', {
            title: 'Login - Fashion Store',
            errors: [{ msg: 'Login failed. Please try again.' }],
            formData: req.body,
            redirectUrl
        });
    }
});

// Logout
router.post('/logout', isAuthenticated, (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/');
    });
});

router.get('/logout', isAuthenticated, (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/');
    });
});

// API endpoints for mobile/frontend apps
// API Register
router.post('/api/register', registerValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        
        const { firstName, lastName, email, password } = req.body;
        
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }
        
        const user = new User({
            firstName,
            lastName,
            email,
            password
        });
        
        await user.save();
        
        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
        );
        
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role
            },
            token
        });
        
    } catch (error) {
        console.error('API Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed'
        });
    }
});

// API Login
router.post('/api/login', loginValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        
        const { email, password } = req.body;
        
        const user = await User.findOne({ email, isActive: true });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        
        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
        );
        
        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role
            },
            token
        });
        
    } catch (error) {
        console.error('API Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
});

module.exports = router;