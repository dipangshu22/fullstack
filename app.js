require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');

// Import database connection
const connectDB = require('./src/config/database');

// Import routes
const authRoutes = require('./src/controller/authController');
const categoryRoutes = require('./src/controller/categoryController');
const productRoutes = require('./src/controller/productController');
const cartRoutes = require('./src/controller/cartController');
const orderRoutes = require('./src/controller/orderController');
const adminRoutes = require('./src/controller/adminController');
const userRoutes = require('./src/controller/userController');

const app = express();
const port = process.env.PORT || 8810;

// Connect to database
connectDB();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false // Disable for development
}));

// Compression middleware
app.use(compression());

// CORS middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? 'your-domain.com' : 'http://localhost:3000',
    credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions'
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    }
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// View engine setup
app.set('views', path.join(__dirname, 'src/views'));
app.set('view engine', 'ejs');

// Make user data available to all views
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.cartCount = req.session.cartCount || 0;
    next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/admin', adminRoutes);

// Main routes
app.get('/', async (req, res) => {
    try {
        const Product = require('./src/models/Product');
        const Category = require('./src/models/Category');
        
        // Get featured products
        const featuredProducts = await Product.find({ 
            isActive: true, 
            isFeatured: true 
        })
        .populate('category')
        .limit(8)
        .sort({ createdAt: -1 });
        
        // Get categories
        const categories = await Category.find({ 
            isActive: true, 
            parentCategory: null 
        })
        .sort({ sortOrder: 1 })
        .limit(6);
        
        // Get latest products
        const latestProducts = await Product.find({ isActive: true })
        .populate('category')
        .sort({ createdAt: -1 })
        .limit(8);
        
        res.render('index', {
            title: 'Fashion Store - Latest Clothing Trends',
            featuredProducts,
            categories,
            latestProducts
        });
    } catch (error) {
        console.error('Error loading homepage:', error);
        res.render('index', {
            title: 'Fashion Store',
            featuredProducts: [],
            categories: [],
            latestProducts: []
        });
    }
});

// Shop page
app.get('/shop', async (req, res) => {
    try {
        const Product = require('./src/models/Product');
        const Category = require('./src/models/Category');
        
        const page = parseInt(req.query.page) || 1;
        const limit = 12;
        const skip = (page - 1) * limit;
        
        let query = { isActive: true };
        
        // Filter by category
        if (req.query.category) {
            query.category = req.query.category;
        }
        
        // Filter by price range
        if (req.query.minPrice || req.query.maxPrice) {
            query.price = {};
            if (req.query.minPrice) query.price.$gte = parseFloat(req.query.minPrice);
            if (req.query.maxPrice) query.price.$lte = parseFloat(req.query.maxPrice);
        }
        
        // Search functionality
        if (req.query.search) {
            query.$text = { $search: req.query.search };
        }
        
        const products = await Product.find(query)
            .populate('category')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
            
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);
        
        const categories = await Category.find({ isActive: true });
        
        res.render('shop', {
            title: 'Shop - Fashion Store',
            products,
            categories,
            currentPage: page,
            totalPages,
            totalProducts,
            filters: req.query
        });
    } catch (error) {
        console.error('Error loading shop:', error);
        res.status(500).render('error', { error: 'Failed to load products' });
    }
});

// Product detail page
app.get('/product/:slug', async (req, res) => {
    try {
        const Product = require('./src/models/Product');
        
        const product = await Product.findOne({ 
            slug: req.params.slug, 
            isActive: true 
        }).populate('category');
        
        if (!product) {
            return res.status(404).render('error', { error: 'Product not found' });
        }
        
        // Increment view count
        product.viewCount += 1;
        await product.save();
        
        // Get related products
        const relatedProducts = await Product.find({
            category: product.category._id,
            _id: { $ne: product._id },
            isActive: true
        }).limit(4);
        
        res.render('product-detail', {
            title: `${product.name} - Fashion Store`,
            product,
            relatedProducts
        });
    } catch (error) {
        console.error('Error loading product:', error);
        res.status(500).render('error', { error: 'Failed to load product' });
    }
});

// Cart page
app.get('/cart', (req, res) => {
    res.render('cart', {
        title: 'Shopping Cart - Fashion Store'
    });
});

// Checkout page
app.get('/checkout', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/auth/login?redirect=/checkout');
    }
    res.render('checkout', {
        title: 'Checkout - Fashion Store'
    });
});

// User account pages
app.get('/account', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    res.render('account', {
        title: 'My Account - Fashion Store'
    });
});

// Error handling middleware
app.use((req, res) => {
    res.status(404).render('error', {
        title: 'Page Not Found',
        error: 'The page you are looking for does not exist.'
    });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', {
        title: 'Server Error',
        error: process.env.NODE_ENV === 'production' 
            ? 'Something went wrong!' 
            : err.message
    });
});

app.listen(port, (err) => {
    if (err) throw err;
    console.log(`🚀 Server is running on port ${port}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
