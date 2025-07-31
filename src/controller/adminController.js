const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const User = require('../models/User');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const { isAdmin } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../public/uploads');
        try {
            await fs.mkdir(uploadPath, { recursive: true });
        } catch (error) {
            console.error('Error creating upload directory:', error);
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Only allow image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// Admin dashboard
router.get('/dashboard', isAdmin, (req, res) => {
    res.render('admin/dashboard', {
        title: 'Admin Dashboard - Fashion Store',
        layout: 'admin'
    });
});

// Get dashboard statistics
router.get('/api/dashboard-stats', isAdmin, async (req, res) => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        // Get various statistics
        const [
            totalUsers,
            totalProducts,
            totalCategories,
            totalOrders,
            recentOrders,
            totalRevenue,
            recentRevenue,
            topSellingProducts,
            lowStockProducts,
            orderStatusBreakdown
        ] = await Promise.all([
            User.countDocuments({ isActive: true }),
            Product.countDocuments({ isActive: true }),
            Category.countDocuments({ isActive: true }),
            Order.countDocuments(),
            Order.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
            Order.aggregate([
                { $group: { _id: null, total: { $sum: '$pricing.total' } } }
            ]),
            Order.aggregate([
                { $match: { createdAt: { $gte: thirtyDaysAgo } } },
                { $group: { _id: null, total: { $sum: '$pricing.total' } } }
            ]),
            Product.find({ isActive: true })
                .sort({ soldCount: -1 })
                .limit(5)
                .select('name soldCount price images')
                .lean(),
            Product.find({ 
                isActive: true,
                totalStock: { $lt: 10, $gt: 0 }
            })
            .sort({ totalStock: 1 })
            .limit(10)
            .select('name totalStock sku')
            .lean(),
            Order.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);
        
        res.json({
            success: true,
            data: {
                counts: {
                    users: totalUsers,
                    products: totalProducts,
                    categories: totalCategories,
                    orders: totalOrders,
                    recentOrders
                },
                revenue: {
                    total: totalRevenue[0]?.total || 0,
                    recent: recentRevenue[0]?.total || 0
                },
                topSellingProducts,
                lowStockProducts,
                orderStatusBreakdown
            }
        });
        
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard statistics'
        });
    }
});

// Products management
router.get('/products', isAdmin, (req, res) => {
    res.render('admin/products', {
        title: 'Manage Products - Admin',
        layout: 'admin'
    });
});

router.get('/products/new', isAdmin, async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true })
            .sort({ name: 1 })
            .lean();
            
        res.render('admin/product-form', {
            title: 'Add New Product - Admin',
            layout: 'admin',
            product: null,
            categories,
            isEdit: false
        });
    } catch (error) {
        console.error('Error loading product form:', error);
        res.status(500).render('error', { error: 'Failed to load page' });
    }
});

router.get('/products/edit/:id', isAdmin, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate('category')
            .lean();
            
        if (!product) {
            return res.status(404).render('error', { error: 'Product not found' });
        }
        
        const categories = await Category.find({ isActive: true })
            .sort({ name: 1 })
            .lean();
            
        res.render('admin/product-form', {
            title: `Edit ${product.name} - Admin`,
            layout: 'admin',
            product,
            categories,
            isEdit: true
        });
    } catch (error) {
        console.error('Error loading product edit form:', error);
        res.status(500).render('error', { error: 'Failed to load page' });
    }
});

// Categories management
router.get('/categories', isAdmin, (req, res) => {
    res.render('admin/categories', {
        title: 'Manage Categories - Admin',
        layout: 'admin'
    });
});

// Orders management
router.get('/orders', isAdmin, (req, res) => {
    res.render('admin/orders', {
        title: 'Manage Orders - Admin',
        layout: 'admin'
    });
});

router.get('/orders/:orderNumber', isAdmin, async (req, res) => {
    try {
        const order = await Order.findOne({ orderNumber: req.params.orderNumber })
            .populate('user', 'firstName lastName email')
            .populate('items.product', 'name slug images')
            .lean();
            
        if (!order) {
            return res.status(404).render('error', { error: 'Order not found' });
        }
        
        res.render('admin/order-detail', {
            title: `Order ${order.orderNumber} - Admin`,
            layout: 'admin',
            order
        });
    } catch (error) {
        console.error('Error loading order detail:', error);
        res.status(500).render('error', { error: 'Failed to load order' });
    }
});

// Users management
router.get('/users', isAdmin, (req, res) => {
    res.render('admin/users', {
        title: 'Manage Users - Admin',
        layout: 'admin'
    });
});

// Get all users (Admin only)
router.get('/api/users', isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        let query = {};
        
        // Search functionality
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            query.$or = [
                { firstName: searchRegex },
                { lastName: searchRegex },
                { email: searchRegex }
            ];
        }
        
        // Filter by role
        if (req.query.role) {
            query.role = req.query.role;
        }
        
        // Filter by active status
        if (req.query.isActive !== undefined) {
            query.isActive = req.query.isActive === 'true';
        }
        
        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
            
        const totalUsers = await User.countDocuments(query);
        const totalPages = Math.ceil(totalUsers / limit);
        
        res.json({
            success: true,
            data: {
                users,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalUsers,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            }
        });
        
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users'
        });
    }
});

// Update user role (Admin only)
router.put('/api/users/:id/role', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        
        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role'
            });
        }
        
        const user = await User.findByIdAndUpdate(
            id,
            { role },
            { new: true, runValidators: true }
        ).select('-password');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        res.json({
            success: true,
            message: 'User role updated successfully',
            data: user
        });
        
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user role'
        });
    }
});

// Toggle user active status (Admin only)
router.put('/api/users/:id/toggle-status', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const user = await User.findById(id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        user.isActive = !user.isActive;
        await user.save();
        
        res.json({
            success: true,
            message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
            data: {
                id: user._id,
                isActive: user.isActive
            }
        });
        
    } catch (error) {
        console.error('Error toggling user status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user status'
        });
    }
});

// File upload endpoint
router.post('/api/upload', isAdmin, upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }
        
        const fileUrl = `/uploads/${req.file.filename}`;
        
        res.json({
            success: true,
            message: 'File uploaded successfully',
            data: {
                filename: req.file.filename,
                url: fileUrl,
                size: req.file.size
            }
        });
        
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload file'
        });
    }
});

// Multiple file upload endpoint
router.post('/api/upload-multiple', isAdmin, upload.array('images', 10), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No files uploaded'
            });
        }
        
        const uploadedFiles = req.files.map(file => ({
            filename: file.filename,
            url: `/uploads/${file.filename}`,
            size: file.size
        }));
        
        res.json({
            success: true,
            message: 'Files uploaded successfully',
            data: uploadedFiles
        });
        
    } catch (error) {
        console.error('Error uploading files:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload files'
        });
    }
});

// Delete uploaded file
router.delete('/api/uploads/:filename', isAdmin, async (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(__dirname, '../../public/uploads', filename);
        
        try {
            await fs.unlink(filePath);
            res.json({
                success: true,
                message: 'File deleted successfully'
            });
        } catch (error) {
            if (error.code === 'ENOENT') {
                res.status(404).json({
                    success: false,
                    message: 'File not found'
                });
            } else {
                throw error;
            }
        }
        
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete file'
        });
    }
});

// Analytics endpoints
router.get('/api/analytics/sales', isAdmin, async (req, res) => {
    try {
        const { period = '30' } = req.query;
        const days = parseInt(period);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        const salesData = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate },
                    status: { $nin: ['cancelled', 'refunded'] }
                }
            },
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
        ]);
        
        res.json({
            success: true,
            data: salesData
        });
        
    } catch (error) {
        console.error('Error fetching sales analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch sales data'
        });
    }
});

module.exports = router;