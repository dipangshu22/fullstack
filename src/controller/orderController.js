const express = require('express');
const { body, validationResult } = require('express-validator');
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

const router = express.Router();

// Get user's orders
router.get('/', isAuthenticated, async (req, res) => {
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
        console.error('Error fetching orders:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch orders'
        });
    }
});

// Get single order
router.get('/:orderNumber', isAuthenticated, async (req, res) => {
    try {
        const { orderNumber } = req.params;
        
        let query = { orderNumber };
        
        // Non-admin users can only view their own orders
        if (req.session.user.role !== 'admin') {
            query.user = req.session.user.id;
        }
        
        const order = await Order.findOne(query)
            .populate('user', 'firstName lastName email')
            .populate('items.product', 'name slug images')
            .lean();
            
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        res.json({
            success: true,
            data: order
        });
        
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order'
        });
    }
});

// Create new order
router.post('/', isAuthenticated, [
    body('shippingAddress.firstName').trim().notEmpty().withMessage('First name is required'),
    body('shippingAddress.lastName').trim().notEmpty().withMessage('Last name is required'),
    body('shippingAddress.email').isEmail().withMessage('Valid email is required'),
    body('shippingAddress.phone').trim().notEmpty().withMessage('Phone number is required'),
    body('shippingAddress.street').trim().notEmpty().withMessage('Street address is required'),
    body('shippingAddress.city').trim().notEmpty().withMessage('City is required'),
    body('shippingAddress.state').trim().notEmpty().withMessage('State is required'),
    body('shippingAddress.zipCode').trim().notEmpty().withMessage('ZIP code is required'),
    body('shippingAddress.country').trim().notEmpty().withMessage('Country is required'),
    body('paymentInfo.method').isIn(['credit_card', 'debit_card', 'paypal', 'stripe', 'cod']).withMessage('Valid payment method is required')
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
        
        const { shippingAddress, billingAddress, paymentInfo, coupon, notes } = req.body;
        
        // Get user's cart
        const user = await User.findById(req.session.user.id)
            .populate('cart.product');
            
        if (!user || !user.cart || user.cart.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Cart is empty'
            });
        }
        
        // Validate cart items and calculate totals
        const orderItems = [];
        let subtotal = 0;
        
        for (const cartItem of user.cart) {
            const product = cartItem.product;
            
            if (!product || !product.isActive) {
                return res.status(400).json({
                    success: false,
                    message: `Product ${product ? product.name : 'unknown'} is no longer available`
                });
            }
            
            // Check variant availability
            const variant = product.variants.find(v => 
                v.size === cartItem.size && v.color === cartItem.color
            );
            
            if (!variant || variant.stock < cartItem.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for ${product.name} (${cartItem.size}, ${cartItem.color})`
                });
            }
            
            const itemPrice = variant.price || product.price;
            const itemTotal = itemPrice * cartItem.quantity;
            
            orderItems.push({
                product: product._id,
                name: product.name,
                price: itemPrice,
                quantity: cartItem.quantity,
                size: cartItem.size,
                color: cartItem.color,
                image: product.images[0]?.url,
                total: itemTotal
            });
            
            subtotal += itemTotal;
        }
        
        // Calculate taxes and shipping
        const tax = Math.round(subtotal * 0.1 * 100) / 100; // 10% tax
        const shipping = subtotal > 100 ? 0 : 10; // Free shipping over $100
        let discount = 0;
        
        // Apply coupon if provided
        if (coupon && coupon.code) {
            // Simple coupon validation (you can enhance this)
            if (coupon.code === 'SAVE10') {
                discount = coupon.type === 'percentage' 
                    ? Math.round(subtotal * 0.1 * 100) / 100 
                    : Math.min(coupon.discount || 10, subtotal);
            }
        }
        
        const total = subtotal + tax + shipping - discount;
        
        // Create order
        const order = new Order({
            user: user._id,
            items: orderItems,
            shippingAddress,
            billingAddress: billingAddress || shippingAddress,
            paymentInfo: {
                method: paymentInfo.method,
                status: paymentInfo.method === 'cod' ? 'pending' : 'completed'
            },
            pricing: {
                subtotal,
                tax,
                shipping,
                discount,
                total
            },
            shipping: {
                method: req.body.shippingMethod || 'standard',
                cost: shipping
            },
            coupon,
            notes: notes || {}
        });
        
        await order.save();
        
        // Update product stock
        for (const item of orderItems) {
            await Product.findOneAndUpdate(
                { 
                    _id: item.product,
                    'variants.size': item.size,
                    'variants.color': item.color
                },
                { 
                    $inc: { 
                        'variants.$.stock': -item.quantity,
                        soldCount: item.quantity
                    }
                }
            );
        }
        
        // Clear user's cart
        user.cart = [];
        await user.save();
        
        // Update session cart count
        req.session.cartCount = 0;
        
        // Add order to user's orders
        await User.findByIdAndUpdate(
            user._id,
            { $push: { orders: order._id } }
        );
        
        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            data: {
                orderNumber: order.orderNumber,
                total: order.pricing.total,
                status: order.status
            }
        });
        
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create order'
        });
    }
});

// Admin routes
// Get all orders (Admin only)
router.get('/admin/all', isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        let query = {};
        
        // Filter by status
        if (req.query.status) {
            query.status = req.query.status;
        }
        
        // Filter by payment status
        if (req.query.paymentStatus) {
            query['paymentInfo.status'] = req.query.paymentStatus;
        }
        
        // Date range filter
        if (req.query.startDate || req.query.endDate) {
            query.createdAt = {};
            if (req.query.startDate) {
                query.createdAt.$gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                query.createdAt.$lte = new Date(req.query.endDate);
            }
        }
        
        const orders = await Order.find(query)
            .populate('user', 'firstName lastName email')
            .populate('items.product', 'name slug')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
            
        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / limit);
        
        // Calculate summary statistics
        const stats = await Order.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$pricing.total' },
                    averageOrderValue: { $avg: '$pricing.total' },
                    totalOrders: { $sum: 1 }
                }
            }
        ]);
        
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
                },
                stats: stats[0] || {
                    totalRevenue: 0,
                    averageOrderValue: 0,
                    totalOrders: 0
                }
            }
        });
        
    } catch (error) {
        console.error('Error fetching admin orders:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch orders'
        });
    }
});

// Update order status (Admin only)
router.put('/:orderNumber/status', isAdmin, [
    body('status').isIn([
        'pending', 'confirmed', 'processing', 'shipped', 
        'delivered', 'cancelled', 'returned', 'refunded'
    ]).withMessage('Valid status is required'),
    body('note').optional().trim()
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
        
        const { orderNumber } = req.params;
        const { status, note } = req.body;
        
        const order = await Order.findOne({ orderNumber });
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        await order.updateStatus(status, note);
        
        res.json({
            success: true,
            message: 'Order status updated successfully',
            data: {
                orderNumber: order.orderNumber,
                status: order.status
            }
        });
        
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update order status'
        });
    }
});

// Update shipping information (Admin only)
router.put('/:orderNumber/shipping', isAdmin, [
    body('trackingNumber').optional().trim(),
    body('carrier').optional().trim(),
    body('estimatedDelivery').optional().isISO8601().withMessage('Valid date is required')
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
        
        const { orderNumber } = req.params;
        const { trackingNumber, carrier, estimatedDelivery } = req.body;
        
        const order = await Order.findOneAndUpdate(
            { orderNumber },
            {
                $set: {
                    'shipping.trackingNumber': trackingNumber,
                    'shipping.carrier': carrier,
                    'shipping.estimatedDelivery': estimatedDelivery ? new Date(estimatedDelivery) : undefined
                }
            },
            { new: true }
        );
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Shipping information updated successfully',
            data: {
                orderNumber: order.orderNumber,
                shipping: order.shipping
            }
        });
        
    } catch (error) {
        console.error('Error updating shipping info:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update shipping information'
        });
    }
});

// Get order statistics (Admin only)
router.get('/admin/stats', isAdmin, async (req, res) => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const stats = await Order.aggregate([
            {
                $facet: {
                    totalStats: [
                        {
                            $group: {
                                _id: null,
                                totalOrders: { $sum: 1 },
                                totalRevenue: { $sum: '$pricing.total' },
                                averageOrderValue: { $avg: '$pricing.total' }
                            }
                        }
                    ],
                    recentStats: [
                        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
                        {
                            $group: {
                                _id: null,
                                recentOrders: { $sum: 1 },
                                recentRevenue: { $sum: '$pricing.total' }
                            }
                        }
                    ],
                    statusBreakdown: [
                        {
                            $group: {
                                _id: '$status',
                                count: { $sum: 1 }
                            }
                        }
                    ],
                    dailyOrders: [
                        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
                        {
                            $group: {
                                _id: {
                                    $dateToString: {
                                        format: '%Y-%m-%d',
                                        date: '$createdAt'
                                    }
                                },
                                orders: { $sum: 1 },
                                revenue: { $sum: '$pricing.total' }
                            }
                        },
                        { $sort: { _id: 1 } }
                    ]
                }
            }
        ]);
        
        const result = stats[0];
        
        res.json({
            success: true,
            data: {
                total: result.totalStats[0] || { totalOrders: 0, totalRevenue: 0, averageOrderValue: 0 },
                recent: result.recentStats[0] || { recentOrders: 0, recentRevenue: 0 },
                statusBreakdown: result.statusBreakdown,
                dailyTrend: result.dailyOrders
            }
        });
        
    } catch (error) {
        console.error('Error fetching order stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order statistics'
        });
    }
});

module.exports = router;