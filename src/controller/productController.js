const express = require('express');
const { body, validationResult } = require('express-validator');
const Product = require('../models/Product');
const Category = require('../models/Category');
const { isAuthenticated, isAdmin, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Get all products with filtering and pagination
router.get('/', optionalAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;
        
        let query = { isActive: true };
        let sort = { createdAt: -1 };
        
        // Category filter
        if (req.query.category) {
            query.category = req.query.category;
        }
        
        // Price range filter
        if (req.query.minPrice || req.query.maxPrice) {
            query.price = {};
            if (req.query.minPrice) query.price.$gte = parseFloat(req.query.minPrice);
            if (req.query.maxPrice) query.price.$lte = parseFloat(req.query.maxPrice);
        }
        
        // Size filter
        if (req.query.size) {
            query['variants.size'] = req.query.size;
        }
        
        // Color filter
        if (req.query.color) {
            query['variants.color'] = new RegExp(req.query.color, 'i');
        }
        
        // Brand filter
        if (req.query.brand) {
            query.brand = new RegExp(req.query.brand, 'i');
        }
        
        // Search functionality
        if (req.query.search) {
            query.$text = { $search: req.query.search };
        }
        
        // Sorting
        if (req.query.sort) {
            switch (req.query.sort) {
                case 'price_low':
                    sort = { price: 1 };
                    break;
                case 'price_high':
                    sort = { price: -1 };
                    break;
                case 'rating':
                    sort = { 'ratings.average': -1 };
                    break;
                case 'popular':
                    sort = { soldCount: -1 };
                    break;
                case 'newest':
                    sort = { createdAt: -1 };
                    break;
                default:
                    sort = { createdAt: -1 };
            }
        }
        
        // Execute query
        const products = await Product.find(query)
            .populate('category', 'name slug')
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean();
            
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);
        
        res.json({
            success: true,
            data: {
                products,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalProducts,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            }
        });
        
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch products'
        });
    }
});

// Get featured products
router.get('/featured', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 8;
        
        const products = await Product.find({ 
            isActive: true, 
            isFeatured: true 
        })
        .populate('category', 'name slug')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
        
        res.json({
            success: true,
            data: products
        });
        
    } catch (error) {
        console.error('Error fetching featured products:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch featured products'
        });
    }
});

// Get products on sale
router.get('/sale', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 12;
        
        const products = await Product.find({ 
            isActive: true, 
            isOnSale: true,
            $or: [
                { saleEndDate: { $gte: new Date() } },
                { saleEndDate: { $exists: false } }
            ]
        })
        .populate('category', 'name slug')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
        
        res.json({
            success: true,
            data: products
        });
        
    } catch (error) {
        console.error('Error fetching sale products:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch sale products'
        });
    }
});

// Get single product by slug or ID
router.get('/:identifier', async (req, res) => {
    try {
        const { identifier } = req.params;
        
        // Check if identifier is ObjectId or slug
        let query;
        if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
            query = { _id: identifier };
        } else {
            query = { slug: identifier };
        }
        
        query.isActive = true;
        
        const product = await Product.findOne(query)
            .populate('category', 'name slug')
            .lean();
            
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }
        
        // Increment view count (only if not called from admin)
        if (!req.query.admin) {
            await Product.findByIdAndUpdate(product._id, {
                $inc: { viewCount: 1 }
            });
        }
        
        // Get related products
        const relatedProducts = await Product.find({
            category: product.category._id,
            _id: { $ne: product._id },
            isActive: true
        })
        .populate('category', 'name slug')
        .limit(4)
        .lean();
        
        res.json({
            success: true,
            data: {
                product,
                relatedProducts
            }
        });
        
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch product'
        });
    }
});

// Get product categories for filtering
router.get('/filters/categories', async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true })
            .select('name slug')
            .sort({ name: 1 })
            .lean();
            
        res.json({
            success: true,
            data: categories
        });
        
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch categories'
        });
    }
});

// Get available sizes
router.get('/filters/sizes', async (req, res) => {
    try {
        const sizes = await Product.distinct('variants.size', { isActive: true });
        
        // Sort sizes in a logical order
        const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '28', '30', '32', '34', '36', '38', '40', '42'];
        const sortedSizes = sizes.sort((a, b) => {
            const aIndex = sizeOrder.indexOf(a);
            const bIndex = sizeOrder.indexOf(b);
            if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
        });
        
        res.json({
            success: true,
            data: sortedSizes
        });
        
    } catch (error) {
        console.error('Error fetching sizes:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch sizes'
        });
    }
});

// Get available colors
router.get('/filters/colors', async (req, res) => {
    try {
        const colors = await Product.distinct('variants.color', { isActive: true });
        
        res.json({
            success: true,
            data: colors.sort()
        });
        
    } catch (error) {
        console.error('Error fetching colors:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch colors'
        });
    }
});

// Get available brands
router.get('/filters/brands', async (req, res) => {
    try {
        const brands = await Product.distinct('brand', { 
            isActive: true,
            brand: { $ne: null, $ne: '' }
        });
        
        res.json({
            success: true,
            data: brands.sort()
        });
        
    } catch (error) {
        console.error('Error fetching brands:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch brands'
        });
    }
});

// Search suggestions
router.get('/search/suggestions', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.length < 2) {
            return res.json({
                success: true,
                data: []
            });
        }
        
        const products = await Product.find({
            isActive: true,
            $or: [
                { name: new RegExp(q, 'i') },
                { brand: new RegExp(q, 'i') },
                { tags: new RegExp(q, 'i') }
            ]
        })
        .select('name slug brand')
        .limit(5)
        .lean();
        
        const suggestions = products.map(product => ({
            title: product.name,
            slug: product.slug,
            brand: product.brand
        }));
        
        res.json({
            success: true,
            data: suggestions
        });
        
    } catch (error) {
        console.error('Error fetching search suggestions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch suggestions'
        });
    }
});

// Admin routes for product management
// Create product (Admin only)
router.post('/', isAdmin, async (req, res) => {
    try {
        const {
            name, description, shortDescription, price, comparePrice, costPrice,
            sku, category, brand, variants, features, materials, careInstructions,
            specifications, tags, isFeatured, isOnSale, saleEndDate
        } = req.body;
        
        // Check if SKU already exists
        const existingProduct = await Product.findOne({ sku });
        if (existingProduct) {
            return res.status(400).json({
                success: false,
                message: 'SKU already exists'
            });
        }
        
        const product = new Product({
            name, description, shortDescription, price, comparePrice, costPrice,
            sku, category, brand, variants, features, materials, careInstructions,
            specifications, tags, isFeatured, isOnSale, saleEndDate
        });
        
        await product.save();
        await product.populate('category', 'name slug');
        
        res.status(201).json({
            success: true,
            message: 'Product created successfully',
            data: product
        });
        
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create product'
        });
    }
});

// Update product (Admin only)
router.put('/:id', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        // If SKU is being updated, check for duplicates
        if (updateData.sku) {
            const existingProduct = await Product.findOne({ 
                sku: updateData.sku, 
                _id: { $ne: id } 
            });
            if (existingProduct) {
                return res.status(400).json({
                    success: false,
                    message: 'SKU already exists'
                });
            }
        }
        
        const product = await Product.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate('category', 'name slug');
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Product updated successfully',
            data: product
        });
        
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update product'
        });
    }
});

// Delete product (Admin only)
router.delete('/:id', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const product = await Product.findByIdAndUpdate(
            id,
            { isActive: false },
            { new: true }
        );
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Product deleted successfully'
        });
        
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete product'
        });
    }
});

module.exports = router;