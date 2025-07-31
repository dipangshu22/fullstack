require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Import models
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const connectDB = require('../config/database');

// Sample data
const categories = [
    {
        name: "Men's Clothing",
        description: "Stylish clothing for men",
        image: "/images/categories/mens.jpg",
        sortOrder: 1
    },
    {
        name: "Women's Clothing",
        description: "Fashionable clothing for women",
        image: "/images/categories/womens.jpg",
        sortOrder: 2
    },
    {
        name: "Accessories",
        description: "Fashion accessories and jewelry",
        image: "/images/categories/accessories.jpg",
        sortOrder: 3
    },
    {
        name: "Footwear",
        description: "Shoes and boots for all occasions",
        image: "/images/categories/footwear.jpg",
        sortOrder: 4
    },
    {
        name: "Sportswear",
        description: "Active wear and sports clothing",
        image: "/images/categories/sportswear.jpg",
        sortOrder: 5
    }
];

const subcategories = [
    {
        name: "T-Shirts",
        description: "Casual and formal t-shirts",
        parentCategory: "Men's Clothing"
    },
    {
        name: "Shirts",
        description: "Formal and casual shirts",
        parentCategory: "Men's Clothing"
    },
    {
        name: "Jeans",
        description: "Denim jeans and pants",
        parentCategory: "Men's Clothing"
    },
    {
        name: "Dresses",
        description: "Casual and formal dresses",
        parentCategory: "Women's Clothing"
    },
    {
        name: "Tops",
        description: "Blouses and casual tops",
        parentCategory: "Women's Clothing"
    },
    {
        name: "Skirts",
        description: "Mini, midi, and maxi skirts",
        parentCategory: "Women's Clothing"
    }
];

const products = [
    {
        name: "Classic Cotton T-Shirt",
        description: "Comfortable cotton t-shirt perfect for everyday wear. Made from 100% organic cotton with a relaxed fit.",
        shortDescription: "Comfortable cotton t-shirt for everyday wear",
        price: 29.99,
        comparePrice: 39.99,
        costPrice: 15.00,
        sku: "CT001",
        category: "T-Shirts",
        brand: "ComfortWear",
        variants: [
            { size: "S", color: "White", colorCode: "#FFFFFF", stock: 50 },
            { size: "M", color: "White", colorCode: "#FFFFFF", stock: 45 },
            { size: "L", color: "White", colorCode: "#FFFFFF", stock: 30 },
            { size: "S", color: "Black", colorCode: "#000000", stock: 40 },
            { size: "M", color: "Black", colorCode: "#000000", stock: 55 },
            { size: "L", color: "Black", colorCode: "#000000", stock: 35 },
            { size: "S", color: "Navy", colorCode: "#001f3f", stock: 25 },
            { size: "M", color: "Navy", colorCode: "#001f3f", stock: 30 },
            { size: "L", color: "Navy", colorCode: "#001f3f", stock: 20 }
        ],
        images: [
            { url: "/images/products/tshirt-white-1.jpg", alt: "White T-Shirt Front", isMain: true },
            { url: "/images/products/tshirt-white-2.jpg", alt: "White T-Shirt Back", isMain: false }
        ],
        features: ["100% Organic Cotton", "Machine Washable", "Tagless Design"],
        materials: ["Cotton"],
        careInstructions: ["Machine wash cold", "Tumble dry low", "Do not bleach"],
        specifications: {
            fabric: "100% Organic Cotton",
            fit: "Regular",
            neckline: "Crew Neck",
            sleeves: "Short Sleeve"
        },
        tags: ["casual", "cotton", "basic", "everyday"],
        isFeatured: true,
        isOnSale: true
    },
    {
        name: "Slim Fit Denim Jeans",
        description: "Modern slim fit jeans crafted from premium denim. Features a comfortable stretch fabric and classic five-pocket styling.",
        shortDescription: "Premium slim fit denim jeans",
        price: 89.99,
        comparePrice: 120.00,
        costPrice: 45.00,
        sku: "DJ001",
        category: "Jeans",
        brand: "DenimPro",
        variants: [
            { size: "30", color: "Dark Blue", colorCode: "#1e3a8a", stock: 25 },
            { size: "32", color: "Dark Blue", colorCode: "#1e3a8a", stock: 30 },
            { size: "34", color: "Dark Blue", colorCode: "#1e3a8a", stock: 35 },
            { size: "36", color: "Dark Blue", colorCode: "#1e3a8a", stock: 20 },
            { size: "30", color: "Light Blue", colorCode: "#3b82f6", stock: 20 },
            { size: "32", color: "Light Blue", colorCode: "#3b82f6", stock: 25 },
            { size: "34", color: "Light Blue", colorCode: "#3b82f6", stock: 30 },
            { size: "36", color: "Light Blue", colorCode: "#3b82f6", stock: 15 }
        ],
        images: [
            { url: "/images/products/jeans-dark-1.jpg", alt: "Dark Blue Jeans", isMain: true },
            { url: "/images/products/jeans-light-1.jpg", alt: "Light Blue Jeans", isMain: false }
        ],
        features: ["Stretch Fabric", "Five Pocket Design", "Button Fly"],
        materials: ["98% Cotton", "2% Elastane"],
        careInstructions: ["Machine wash cold", "Hang dry", "Iron on medium heat"],
        specifications: {
            fabric: "98% Cotton, 2% Elastane",
            fit: "Slim",
            rise: "Mid Rise"
        },
        tags: ["denim", "jeans", "slim fit", "casual"],
        isFeatured: true
    },
    {
        name: "Elegant Summer Dress",
        description: "Beautiful floral summer dress perfect for warm weather. Features a flattering A-line silhouette and breathable fabric.",
        shortDescription: "Floral summer dress with A-line silhouette",
        price: 79.99,
        comparePrice: 99.99,
        costPrice: 35.00,
        sku: "SD001",
        category: "Dresses",
        brand: "SummerStyle",
        variants: [
            { size: "XS", color: "Floral Pink", colorCode: "#fce7f3", stock: 15 },
            { size: "S", color: "Floral Pink", colorCode: "#fce7f3", stock: 25 },
            { size: "M", color: "Floral Pink", colorCode: "#fce7f3", stock: 30 },
            { size: "L", color: "Floral Pink", colorCode: "#fce7f3", stock: 20 },
            { size: "XS", color: "Floral Blue", colorCode: "#dbeafe", stock: 12 },
            { size: "S", color: "Floral Blue", colorCode: "#dbeafe", stock: 20 },
            { size: "M", color: "Floral Blue", colorCode: "#dbeafe", stock: 25 },
            { size: "L", color: "Floral Blue", colorCode: "#dbeafe", stock: 18 }
        ],
        images: [
            { url: "/images/products/dress-floral-pink-1.jpg", alt: "Pink Floral Dress", isMain: true },
            { url: "/images/products/dress-floral-blue-1.jpg", alt: "Blue Floral Dress", isMain: false }
        ],
        features: ["Floral Print", "A-Line Silhouette", "Sleeveless Design"],
        materials: ["100% Viscose"],
        careInstructions: ["Hand wash only", "Hang dry", "Do not bleach"],
        specifications: {
            fabric: "100% Viscose",
            fit: "A-Line",
            neckline: "V-Neck",
            sleeves: "Sleeveless",
            occasion: "Casual",
            season: "Summer"
        },
        tags: ["dress", "floral", "summer", "casual", "feminine"],
        isFeatured: true,
        isOnSale: true
    },
    {
        name: "Business Formal Shirt",
        description: "Professional dress shirt perfect for business and formal occasions. Made from premium cotton with a classic fit.",
        shortDescription: "Premium cotton dress shirt for business",
        price: 69.99,
        costPrice: 30.00,
        sku: "BS001",
        category: "Shirts",
        brand: "BusinessPro",
        variants: [
            { size: "S", color: "White", colorCode: "#FFFFFF", stock: 20 },
            { size: "M", color: "White", colorCode: "#FFFFFF", stock: 30 },
            { size: "L", color: "White", colorCode: "#FFFFFF", stock: 25 },
            { size: "XL", color: "White", colorCode: "#FFFFFF", stock: 15 },
            { size: "S", color: "Light Blue", colorCode: "#e0f2fe", stock: 18 },
            { size: "M", color: "Light Blue", colorCode: "#e0f2fe", stock: 25 },
            { size: "L", color: "Light Blue", colorCode: "#e0f2fe", stock: 20 },
            { size: "XL", color: "Light Blue", colorCode: "#e0f2fe", stock: 12 }
        ],
        images: [
            { url: "/images/products/shirt-white-1.jpg", alt: "White Business Shirt", isMain: true },
            { url: "/images/products/shirt-blue-1.jpg", alt: "Light Blue Business Shirt", isMain: false }
        ],
        features: ["Premium Cotton", "Non-Iron", "Classic Fit"],
        materials: ["100% Cotton"],
        careInstructions: ["Machine wash warm", "Tumble dry medium", "Iron if needed"],
        specifications: {
            fabric: "100% Cotton",
            fit: "Classic",
            neckline: "Spread Collar",
            sleeves: "Long Sleeve",
            occasion: "Business"
        },
        tags: ["business", "formal", "shirt", "cotton", "professional"],
        isFeatured: false
    },
    {
        name: "Athletic Running Shorts",
        description: "High-performance running shorts with moisture-wicking technology. Perfect for workouts and outdoor activities.",
        shortDescription: "Moisture-wicking athletic running shorts",
        price: 34.99,
        comparePrice: 45.99,
        costPrice: 18.00,
        sku: "AS001",
        category: "Sportswear",
        brand: "ActiveGear",
        variants: [
            { size: "S", color: "Black", colorCode: "#000000", stock: 30 },
            { size: "M", color: "Black", colorCode: "#000000", stock: 35 },
            { size: "L", color: "Black", colorCode: "#000000", stock: 25 },
            { size: "S", color: "Navy", colorCode: "#001f3f", stock: 25 },
            { size: "M", color: "Navy", colorCode: "#001f3f", stock: 30 },
            { size: "L", color: "Navy", colorCode: "#001f3f", stock: 20 },
            { size: "S", color: "Gray", colorCode: "#6b7280", stock: 20 },
            { size: "M", color: "Gray", colorCode: "#6b7280", stock: 25 },
            { size: "L", color: "Gray", colorCode: "#6b7280", stock: 18 }
        ],
        images: [
            { url: "/images/products/shorts-black-1.jpg", alt: "Black Athletic Shorts", isMain: true },
            { url: "/images/products/shorts-navy-1.jpg", alt: "Navy Athletic Shorts", isMain: false }
        ],
        features: ["Moisture-Wicking", "Quick-Dry", "Side Pockets"],
        materials: ["88% Polyester", "12% Elastane"],
        careInstructions: ["Machine wash cold", "Tumble dry low", "Do not iron"],
        specifications: {
            fabric: "88% Polyester, 12% Elastane",
            fit: "Athletic",
            occasion: "Sports",
            season: "All Season"
        },
        tags: ["athletic", "running", "shorts", "sportswear", "workout"],
        isFeatured: false,
        isOnSale: true
    }
];

async function seedDatabase() {
    try {
        // Connect to database
        await connectDB();
        console.log('Connected to database');

        // Clear existing data
        console.log('Clearing existing data...');
        await User.deleteMany({});
        await Category.deleteMany({});
        await Product.deleteMany({});

        // Create admin user
        console.log('Creating admin user...');
        const adminPassword = await bcrypt.hash('admin123', 10);
        const adminUser = new User({
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@fashionstore.com',
            password: adminPassword,
            role: 'admin'
        });
        await adminUser.save();
        console.log('Admin user created: admin@fashionstore.com / admin123');

        // Create demo user
        const demoPassword = await bcrypt.hash('demo123', 10);
        const demoUser = new User({
            firstName: 'Demo',
            lastName: 'User',
            email: 'demo@fashionstore.com',
            password: demoPassword,
            role: 'user',
            address: {
                street: '123 Demo Street',
                city: 'Demo City',
                state: 'Demo State',
                zipCode: '12345',
                country: 'USA'
            },
            phone: '555-123-4567'
        });
        await demoUser.save();
        console.log('Demo user created: demo@fashionstore.com / demo123');

        // Create categories
        console.log('Creating categories...');
        const createdCategories = [];
        for (const categoryData of categories) {
            const category = new Category(categoryData);
            await category.save();
            createdCategories.push(category);
            console.log(`Created category: ${category.name}`);
        }

        // Create subcategories
        console.log('Creating subcategories...');
        for (const subCategoryData of subcategories) {
            const parentCategory = createdCategories.find(c => c.name === subCategoryData.parentCategory);
            if (parentCategory) {
                const subCategory = new Category({
                    name: subCategoryData.name,
                    description: subCategoryData.description,
                    parentCategory: parentCategory._id
                });
                await subCategory.save();
                
                // Add to parent's subcategories
                parentCategory.subCategories.push(subCategory._id);
                await parentCategory.save();
                
                console.log(`Created subcategory: ${subCategory.name} under ${parentCategory.name}`);
            }
        }

        // Create products
        console.log('Creating products...');
        const allCategories = await Category.find();
        for (const productData of products) {
            const category = allCategories.find(c => c.name === productData.category);
            if (category) {
                const product = new Product({
                    ...productData,
                    category: category._id
                });
                await product.save();
                console.log(`Created product: ${product.name}`);
            }
        }

        console.log('\n✅ Database seeded successfully!');
        console.log('\n📋 Login Credentials:');
        console.log('Admin: admin@fashionstore.com / admin123');
        console.log('Demo User: demo@fashionstore.com / demo123');
        console.log('\n🎯 You can now start the server with: npm run dev');

    } catch (error) {
        console.error('Error seeding database:', error);
    } finally {
        mongoose.connection.close();
    }
}

// Run the seed function
if (require.main === module) {
    seedDatabase();
}

module.exports = seedDatabase;