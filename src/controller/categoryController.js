const express = require('express');
const { body, validationResult } = require('express-validator');
const Category = require('../models/Category');
const Product = require('../models/Product');
const { isAdmin, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Get all categories
router.get('/', async (req, res) => {
    try {
        const includeInactive = req.query.includeInactive === 'true';
        const query = includeInactive ? {} : { isActive: true };
        
        const categories = await Category.find(query)
            .populate('parentCategory', 'name slug')
            .populate('subCategories', 'name slug')
            .sort({ sortOrder: 1, name: 1 })
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

// Get main categories (no parent)
router.get('/main', async (req, res) => {
    try {
        const categories = await Category.find({ 
            isActive: true,
            parentCategory: null
        })
        .populate('subCategories', 'name slug')
        .sort({ sortOrder: 1, name: 1 })
        .lean();
        
        res.json({
            success: true,
            data: categories
        });
        
    } catch (error) {
        console.error('Error fetching main categories:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch main categories'
        });
    }
});

// Get category by slug
router.get('/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        
        const category = await Category.findOne({ 
            slug, 
            isActive: true 
        })
        .populate('parentCategory', 'name slug')
        .populate('subCategories', 'name slug')
        .lean();
        
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }
        
        // Get products in this category
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;
        
        const products = await Product.find({ 
            category: category._id,
            isActive: true
        })
        .populate('category', 'name slug')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
        
        const totalProducts = await Product.countDocuments({ 
            category: category._id,
            isActive: true
        });
        
        const totalPages = Math.ceil(totalProducts / limit);
        
        res.json({
            success: true,
            data: {
                category,
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
        console.error('Error fetching category:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch category'
        });
    }
});

// Get subcategories of a category
router.get('/:slug/subcategories', async (req, res) => {
    try {
        const { slug } = req.params;
        
        const parentCategory = await Category.findOne({ 
            slug, 
            isActive: true 
        });
        
        if (!parentCategory) {
            return res.status(404).json({
                success: false,
                message: 'Parent category not found'
            });
        }
        
        const subcategories = await Category.find({
            parentCategory: parentCategory._id,
            isActive: true
        })
        .sort({ sortOrder: 1, name: 1 })
        .lean();
        
        res.json({
            success: true,
            data: subcategories
        });
        
    } catch (error) {
        console.error('Error fetching subcategories:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subcategories'
        });
    }
});

// Admin routes for category management
// Create category (Admin only)
router.post('/', isAdmin, [
    body('name').trim().notEmpty().withMessage('Category name is required'),
    body('description').optional().trim(),
    body('parentCategory').optional().isMongoId().withMessage('Invalid parent category ID')
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
        
        const { name, description, image, parentCategory, sortOrder } = req.body;
        
        // Check if category name already exists
        const existingCategory = await Category.findOne({ name });
        if (existingCategory) {
            return res.status(400).json({
                success: false,
                message: 'Category name already exists'
            });
        }
        
        const category = new Category({
            name,
            description,
            image,
            parentCategory: parentCategory || null,
            sortOrder: sortOrder || 0
        });
        
        await category.save();
        
        // If this is a subcategory, add it to parent's subCategories array
        if (parentCategory) {
            await Category.findByIdAndUpdate(
                parentCategory,
                { $push: { subCategories: category._id } }
            );
        }
        
        await category.populate('parentCategory', 'name slug');
        
        res.status(201).json({
            success: true,
            message: 'Category created successfully',
            data: category
        });
        
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create category'
        });
    }
});

// Update category (Admin only)
router.put('/:id', isAdmin, [
    body('name').optional().trim().notEmpty().withMessage('Category name cannot be empty'),
    body('description').optional().trim(),
    body('parentCategory').optional().isMongoId().withMessage('Invalid parent category ID')
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
        
        const { id } = req.params;
        const updateData = req.body;
        
        // If name is being updated, check for duplicates
        if (updateData.name) {
            const existingCategory = await Category.findOne({ 
                name: updateData.name, 
                _id: { $ne: id } 
            });
            if (existingCategory) {
                return res.status(400).json({
                    success: false,
                    message: 'Category name already exists'
                });
            }
        }
        
        const category = await Category.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate('parentCategory', 'name slug');
        
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Category updated successfully',
            data: category
        });
        
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update category'
        });
    }
});

// Delete category (Admin only)
router.delete('/:id', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if category has products
        const productCount = await Product.countDocuments({ category: id });
        if (productCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete category. It has ${productCount} products.`
            });
        }
        
        // Check if category has subcategories
        const subcategoryCount = await Category.countDocuments({ parentCategory: id });
        if (subcategoryCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete category. It has ${subcategoryCount} subcategories.`
            });
        }
        
        const category = await Category.findByIdAndUpdate(
            id,
            { isActive: false },
            { new: true }
        );
        
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }
        
        // Remove from parent's subCategories array if it's a subcategory
        if (category.parentCategory) {
            await Category.findByIdAndUpdate(
                category.parentCategory,
                { $pull: { subCategories: category._id } }
            );
        }
        
        res.json({
            success: true,
            message: 'Category deleted successfully'
        });
        
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete category'
        });
    }
});

module.exports = router;