const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Product = require('../models/Product');
const { isAuthenticated, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Get cart contents
router.get('/', optionalAuth, async (req, res) => {
    try {
        let cartItems = [];
        
        if (req.session.user) {
            // Get cart from user document
            const user = await User.findById(req.session.user.id)
                .populate({
                    path: 'cart.product',
                    select: 'name slug price images variants totalStock isActive'
                });
                
            if (user) {
                cartItems = user.cart.filter(item => 
                    item.product && item.product.isActive
                );
            }
        } else {
            // Get cart from session for guest users
            cartItems = req.session.cart || [];
            
            // Populate product details for session cart
            if (cartItems.length > 0) {
                const productIds = cartItems.map(item => item.product);
                const products = await Product.find({
                    _id: { $in: productIds },
                    isActive: true
                }).select('name slug price images variants totalStock').lean();
                
                cartItems = cartItems.map(item => {
                    const product = products.find(p => p._id.toString() === item.product);
                    return {
                        ...item,
                        product
                    };
                }).filter(item => item.product); // Filter out items with inactive products
            }
        }
        
        // Calculate totals
        let subtotal = 0;
        const validItems = [];
        
        for (const item of cartItems) {
            if (item.product) {
                // Check if variant exists and has stock
                const variant = item.product.variants.find(v => 
                    v.size === item.size && v.color === item.color
                );
                
                if (variant && variant.stock >= item.quantity) {
                    const itemPrice = variant.price || item.product.price;
                    const itemTotal = itemPrice * item.quantity;
                    
                    validItems.push({
                        ...item,
                        itemPrice,
                        itemTotal,
                        inStock: true
                    });
                    
                    subtotal += itemTotal;
                } else {
                    // Item out of stock or variant not available
                    validItems.push({
                        ...item,
                        itemPrice: item.product.price,
                        itemTotal: 0,
                        inStock: false,
                        availableStock: variant ? variant.stock : 0
                    });
                }
            }
        }
        
        const tax = subtotal * 0.1; // 10% tax
        const shipping = subtotal > 100 ? 0 : 10; // Free shipping over $100
        const total = subtotal + tax + shipping;
        
        res.json({
            success: true,
            data: {
                items: validItems,
                count: validItems.length,
                pricing: {
                    subtotal: Math.round(subtotal * 100) / 100,
                    tax: Math.round(tax * 100) / 100,
                    shipping: Math.round(shipping * 100) / 100,
                    total: Math.round(total * 100) / 100
                }
            }
        });
        
    } catch (error) {
        console.error('Error fetching cart:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch cart'
        });
    }
});

// Add item to cart
router.post('/add', optionalAuth, [
    body('productId').isMongoId().withMessage('Valid product ID is required'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('size').notEmpty().withMessage('Size is required'),
    body('color').notEmpty().withMessage('Color is required')
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
        
        const { productId, quantity, size, color } = req.body;
        
        // Check if product exists and is active
        const product = await Product.findOne({ 
            _id: productId, 
            isActive: true 
        });
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found or not available'
            });
        }
        
        // Check if variant exists and has sufficient stock
        const variant = product.variants.find(v => 
            v.size === size && v.color === color
        );
        
        if (!variant) {
            return res.status(400).json({
                success: false,
                message: 'Selected size and color combination is not available'
            });
        }
        
        if (variant.stock < quantity) {
            return res.status(400).json({
                success: false,
                message: `Only ${variant.stock} items available in stock`
            });
        }
        
        if (req.session.user) {
            // Add to user's cart
            const user = await User.findById(req.session.user.id);
            
            // Check if item already exists in cart
            const existingItemIndex = user.cart.findIndex(item => 
                item.product.toString() === productId && 
                item.size === size && 
                item.color === color
            );
            
            if (existingItemIndex > -1) {
                // Update quantity
                const newQuantity = user.cart[existingItemIndex].quantity + quantity;
                
                if (variant.stock < newQuantity) {
                    return res.status(400).json({
                        success: false,
                        message: `Only ${variant.stock} items available in stock`
                    });
                }
                
                user.cart[existingItemIndex].quantity = newQuantity;
            } else {
                // Add new item
                user.cart.push({
                    product: productId,
                    quantity,
                    size,
                    color
                });
            }
            
            await user.save();
            
            // Update session cart count
            req.session.cartCount = user.cart.length;
            
        } else {
            // Add to session cart for guest users
            if (!req.session.cart) {
                req.session.cart = [];
            }
            
            const existingItemIndex = req.session.cart.findIndex(item => 
                item.product === productId && 
                item.size === size && 
                item.color === color
            );
            
            if (existingItemIndex > -1) {
                const newQuantity = req.session.cart[existingItemIndex].quantity + quantity;
                
                if (variant.stock < newQuantity) {
                    return res.status(400).json({
                        success: false,
                        message: `Only ${variant.stock} items available in stock`
                    });
                }
                
                req.session.cart[existingItemIndex].quantity = newQuantity;
            } else {
                req.session.cart.push({
                    product: productId,
                    quantity,
                    size,
                    color
                });
            }
            
            req.session.cartCount = req.session.cart.length;
        }
        
        res.json({
            success: true,
            message: 'Item added to cart successfully'
        });
        
    } catch (error) {
        console.error('Error adding to cart:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add item to cart'
        });
    }
});

// Update cart item quantity
router.put('/update', optionalAuth, [
    body('productId').isMongoId().withMessage('Valid product ID is required'),
    body('quantity').isInt({ min: 0 }).withMessage('Quantity must be 0 or greater'),
    body('size').notEmpty().withMessage('Size is required'),
    body('color').notEmpty().withMessage('Color is required')
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
        
        const { productId, quantity, size, color } = req.body;
        
        if (quantity === 0) {
            // Remove item from cart
            return router.handle({
                method: 'DELETE',
                url: '/remove',
                body: { productId, size, color }
            }, res);
        }
        
        // Check product and variant availability
        const product = await Product.findOne({ 
            _id: productId, 
            isActive: true 
        });
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }
        
        const variant = product.variants.find(v => 
            v.size === size && v.color === color
        );
        
        if (!variant || variant.stock < quantity) {
            return res.status(400).json({
                success: false,
                message: `Only ${variant ? variant.stock : 0} items available in stock`
            });
        }
        
        if (req.session.user) {
            // Update user's cart
            const user = await User.findById(req.session.user.id);
            
            const itemIndex = user.cart.findIndex(item => 
                item.product.toString() === productId && 
                item.size === size && 
                item.color === color
            );
            
            if (itemIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: 'Item not found in cart'
                });
            }
            
            user.cart[itemIndex].quantity = quantity;
            await user.save();
            
        } else {
            // Update session cart
            if (!req.session.cart) {
                return res.status(404).json({
                    success: false,
                    message: 'Cart is empty'
                });
            }
            
            const itemIndex = req.session.cart.findIndex(item => 
                item.product === productId && 
                item.size === size && 
                item.color === color
            );
            
            if (itemIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: 'Item not found in cart'
                });
            }
            
            req.session.cart[itemIndex].quantity = quantity;
        }
        
        res.json({
            success: true,
            message: 'Cart updated successfully'
        });
        
    } catch (error) {
        console.error('Error updating cart:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update cart'
        });
    }
});

// Remove item from cart
router.delete('/remove', optionalAuth, [
    body('productId').isMongoId().withMessage('Valid product ID is required'),
    body('size').notEmpty().withMessage('Size is required'),
    body('color').notEmpty().withMessage('Color is required')
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
        
        const { productId, size, color } = req.body;
        
        if (req.session.user) {
            // Remove from user's cart
            const user = await User.findById(req.session.user.id);
            
            user.cart = user.cart.filter(item => 
                !(item.product.toString() === productId && 
                  item.size === size && 
                  item.color === color)
            );
            
            await user.save();
            req.session.cartCount = user.cart.length;
            
        } else {
            // Remove from session cart
            if (req.session.cart) {
                req.session.cart = req.session.cart.filter(item => 
                    !(item.product === productId && 
                      item.size === size && 
                      item.color === color)
                );
                req.session.cartCount = req.session.cart.length;
            }
        }
        
        res.json({
            success: true,
            message: 'Item removed from cart successfully'
        });
        
    } catch (error) {
        console.error('Error removing from cart:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove item from cart'
        });
    }
});

// Clear entire cart
router.delete('/clear', optionalAuth, async (req, res) => {
    try {
        if (req.session.user) {
            // Clear user's cart
            await User.findByIdAndUpdate(
                req.session.user.id,
                { cart: [] }
            );
            req.session.cartCount = 0;
        } else {
            // Clear session cart
            req.session.cart = [];
            req.session.cartCount = 0;
        }
        
        res.json({
            success: true,
            message: 'Cart cleared successfully'
        });
        
    } catch (error) {
        console.error('Error clearing cart:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to clear cart'
        });
    }
});

// Transfer session cart to user cart on login
router.post('/transfer', isAuthenticated, async (req, res) => {
    try {
        if (!req.session.cart || req.session.cart.length === 0) {
            return res.json({
                success: true,
                message: 'No session cart to transfer'
            });
        }
        
        const user = await User.findById(req.session.user.id);
        
        // Merge session cart with user cart
        for (const sessionItem of req.session.cart) {
            const existingItemIndex = user.cart.findIndex(item => 
                item.product.toString() === sessionItem.product && 
                item.size === sessionItem.size && 
                item.color === sessionItem.color
            );
            
            if (existingItemIndex > -1) {
                // Update quantity
                user.cart[existingItemIndex].quantity += sessionItem.quantity;
            } else {
                // Add new item
                user.cart.push({
                    product: sessionItem.product,
                    quantity: sessionItem.quantity,
                    size: sessionItem.size,
                    color: sessionItem.color
                });
            }
        }
        
        await user.save();
        
        // Clear session cart
        req.session.cart = [];
        req.session.cartCount = user.cart.length;
        
        res.json({
            success: true,
            message: 'Cart transferred successfully'
        });
        
    } catch (error) {
        console.error('Error transferring cart:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to transfer cart'
        });
    }
});

module.exports = router;