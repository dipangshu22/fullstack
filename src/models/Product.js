const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true
    },
    slug: {
        type: String,
        unique: true,
        lowercase: true
    },
    description: {
        type: String,
        required: [true, 'Product description is required']
    },
    shortDescription: {
        type: String,
        maxlength: 200
    },
    price: {
        type: Number,
        required: [true, 'Product price is required'],
        min: 0
    },
    comparePrice: {
        type: Number,
        min: 0
    },
    costPrice: {
        type: Number,
        min: 0
    },
    sku: {
        type: String,
        unique: true,
        required: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: [true, 'Product category is required']
    },
    brand: {
        type: String,
        trim: true
    },
    images: [{
        url: String,
        alt: String,
        isMain: {
            type: Boolean,
            default: false
        }
    }],
    variants: [{
        size: {
            type: String,
            required: true,
            enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '28', '30', '32', '34', '36', '38', '40', '42']
        },
        color: {
            type: String,
            required: true
        },
        colorCode: String,
        stock: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },
        price: Number // Optional: variant-specific pricing
    }],
    totalStock: {
        type: Number,
        default: 0
    },
    features: [String],
    materials: [String],
    careInstructions: [String],
    specifications: {
        weight: String,
        dimensions: String,
        fabric: String,
        pattern: String,
        sleeves: String,
        neckline: String,
        fit: String,
        occasion: String,
        season: String
    },
    seo: {
        metaTitle: String,
        metaDescription: String,
        keywords: [String]
    },
    ratings: {
        average: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },
        count: {
            type: Number,
            default: 0
        }
    },
    reviews: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Review'
    }],
    tags: [String],
    isActive: {
        type: Boolean,
        default: true
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    isOnSale: {
        type: Boolean,
        default: false
    },
    saleEndDate: Date,
    viewCount: {
        type: Number,
        default: 0
    },
    soldCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Create slug from name before saving
productSchema.pre('save', function(next) {
    if (this.isModified('name')) {
        this.slug = this.name.toLowerCase()
            .replace(/[^a-zA-Z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }
    
    // Calculate total stock from variants
    this.totalStock = this.variants.reduce((total, variant) => total + variant.stock, 0);
    
    next();
});

// Virtual for discount percentage
productSchema.virtual('discountPercentage').get(function() {
    if (this.comparePrice && this.comparePrice > this.price) {
        return Math.round(((this.comparePrice - this.price) / this.comparePrice) * 100);
    }
    return 0;
});

// Index for search
productSchema.index({
    name: 'text',
    description: 'text',
    'specifications.fabric': 'text',
    brand: 'text',
    tags: 'text'
});

// Index for filtering
productSchema.index({ category: 1, isActive: 1, price: 1 });
productSchema.index({ isFeatured: 1, isActive: 1 });
productSchema.index({ 'ratings.average': -1 });

module.exports = mongoose.model('Product', productSchema);