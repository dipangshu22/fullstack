const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Order = require('../models/Order');
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();

// Get user profile
router.get('/profile', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id)
            .select('-password')
            .populate({
                path: 'orders',
                select: 'orderNumber status pricing.total createdAt',
                options: { sort: { createdAt: -1 }, limit: 5 }
            })
            .lean();
            
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        res.json({
            success: true,
            data: user
        });
        
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user profile'
        });
    }
});

// Update user profile
router.put('/profile', isAuthenticated, [
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('phone').optional().trim(),
    body('address.street').optional().trim(),
    body('address.city').optional().trim(),
    body('address.state').optional().trim(),
    body('address.zipCode').optional().trim(),
    body('address.country').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        
        const { firstName, lastName, email, phone, address } = req.body;
        
        // Check if email is already taken by another user
        const existingUser = await User.findOne({ 
            email, 
            _id: { $ne: req.session.user.id } 
        });
        
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email is already registered to another account'
            });
        }
        
        const user = await User.findByIdAndUpdate(
            req.session.user.id,
            {
                firstName,
                lastName,
                email,
                phone,
                address
            },
            { new: true, runValidators: true }
        ).select('-password');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Update session data
        req.session.user = {
            ...req.session.user,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email
        };
        
        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: user
        });
        
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile'
        });
    }
});

// Change password
router.put('/password', isAuthenticated, [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
    body('confirmPassword').custom((value, { req }) => {
        if (value !== req.body.newPassword) {
            throw new Error('Password confirmation does not match');
        }
        return true;
    })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        
        const { currentPassword, newPassword } = req.body;
        
        const user = await User.findById(req.session.user.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Verify current password
        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        
        if (!isCurrentPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }
        
        // Update password
        user.password = newPassword;
        await user.save();
        
        res.json({
            success: true,
            message: 'Password changed successfully'
        });
        
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to change password'
        });
    }
});

// Get user's wishlist
router.get('/wishlist', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id)
            .populate({
                path: 'wishlist',
                select: 'name slug price images category variants isActive',
                populate: {
                    path: 'category',
                    select: 'name slug'
                }
            })
            .lean();
            
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Filter out inactive products
        const activeWishlistItems = user.wishlist.filter(item => item.isActive);
        
        res.json({
            success: true,
            data: activeWishlistItems
        });
        
    } catch (error) {
        console.error('Error fetching wishlist:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch wishlist'
        });
    }
});

// Add product to wishlist
router.post('/wishlist', isAuthenticated, [
    body('productId').isMongoId().withMessage('Valid product ID is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        
        const { productId } = req.body;
        
        const user = await User.findById(req.session.user.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Check if product already in wishlist
        if (user.wishlist.includes(productId)) {
            return res.status(400).json({
                success: false,
                message: 'Product already in wishlist'
            });
        }
        
        user.wishlist.push(productId);
        await user.save();
        
        res.json({
            success: true,
            message: 'Product added to wishlist'
        });
        
    } catch (error) {
        console.error('Error adding to wishlist:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add product to wishlist'
        });
    }
});

// Remove product from wishlist
router.delete('/wishlist/:productId', isAuthenticated, async (req, res) => {
    try {
        const { productId } = req.params;
        
        const user = await User.findByIdAndUpdate(
            req.session.user.id,
            { $pull: { wishlist: productId } },
            { new: true }
        );
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Product removed from wishlist'
        });
        
    } catch (error) {
        console.error('Error removing from wishlist:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove product from wishlist'
        });
    }
});

// Get user's order history
router.get('/orders', isAuthenticated, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        const orders = await Order.find({ user: req.session.user.id })
            .populate('items.product', 'name slug images')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
            
        const totalOrders = await Order.countDocuments({ user: req.session.user.id });
        const totalPages = Math.ceil(totalOrders / limit);
        
        res.json({
            success: true,
            data: {
                orders,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalOrders,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            }
        });
        
    } catch (error) {
        console.error('Error fetching user orders:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch orders'
        });
    }
});

// Get user dashboard data
router.get('/dashboard', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id)
            .select('-password')
            .lean();
            
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Get order statistics
        const orderStats = await Order.aggregate([
            { $match: { user: user._id } },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalSpent: { $sum: '$pricing.total' },
                    pendingOrders: {
                        $sum: {
                            $cond: [
                                { $in: ['$status', ['pending', 'confirmed', 'processing']] },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]);
        
        // Get recent orders
        const recentOrders = await Order.find({ user: user._id })
            .populate('items.product', 'name slug images')
            .sort({ createdAt: -1 })
            .limit(3)
            .lean();
        
        const stats = orderStats[0] || {
            totalOrders: 0,
            totalSpent: 0,
            pendingOrders: 0
        };
        
        res.json({
            success: true,
            data: {
                user,
                stats,
                recentOrders,
                cartCount: user.cart.length,
                wishlistCount: user.wishlist.length
            }
        });
        
    } catch (error) {
        console.error('Error fetching user dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard data'
        });
    }
});

// Delete user account
router.delete('/account', isAuthenticated, [
    body('password').notEmpty().withMessage('Password is required to delete account')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        
        const { password } = req.body;
        
        const user = await User.findById(req.session.user.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Verify password
        const isPasswordValid = await user.comparePassword(password);
        
        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Incorrect password'
            });
        }
        
        // Check for pending orders
        const pendingOrders = await Order.countDocuments({
            user: user._id,
            status: { $in: ['pending', 'confirmed', 'processing', 'shipped'] }
        });
        
        if (pendingOrders > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete account with pending orders. Please contact support.'
            });
        }
        
        // Soft delete user (deactivate)
        user.isActive = false;
        user.email = `deleted_${Date.now()}_${user.email}`;
        await user.save();
        
        // Destroy session
        req.session.destroy();
        
        res.json({
            success: true,
            message: 'Account deleted successfully'
        });
        
    } catch (error) {
        console.error('Error deleting user account:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete account'
        });
    }
});

module.exports = router;