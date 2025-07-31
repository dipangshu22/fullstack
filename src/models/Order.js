const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        unique: true,
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        name: String,
        price: Number,
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        size: String,
        color: String,
        image: String,
        total: Number
    }],
    shippingAddress: {
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        email: { type: String, required: true },
        phone: { type: String, required: true },
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        zipCode: { type: String, required: true },
        country: { type: String, required: true }
    },
    billingAddress: {
        firstName: String,
        lastName: String,
        email: String,
        phone: String,
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String,
        sameAsShipping: {
            type: Boolean,
            default: true
        }
    },
    paymentInfo: {
        method: {
            type: String,
            enum: ['credit_card', 'debit_card', 'paypal', 'stripe', 'cod'],
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed', 'refunded'],
            default: 'pending'
        },
        transactionId: String,
        paymentDate: Date
    },
    pricing: {
        subtotal: {
            type: Number,
            required: true
        },
        tax: {
            type: Number,
            default: 0
        },
        shipping: {
            type: Number,
            default: 0
        },
        discount: {
            type: Number,
            default: 0
        },
        total: {
            type: Number,
            required: true
        }
    },
    status: {
        type: String,
        enum: [
            'pending',
            'confirmed',
            'processing',
            'shipped',
            'delivered',
            'cancelled',
            'returned',
            'refunded'
        ],
        default: 'pending'
    },
    shipping: {
        method: {
            type: String,
            enum: ['standard', 'express', 'overnight'],
            default: 'standard'
        },
        cost: {
            type: Number,
            default: 0
        },
        trackingNumber: String,
        carrier: String,
        estimatedDelivery: Date,
        actualDelivery: Date
    },
    coupon: {
        code: String,
        discount: Number,
        type: {
            type: String,
            enum: ['percentage', 'fixed']
        }
    },
    notes: {
        customer: String,
        internal: String
    },
    statusHistory: [{
        status: String,
        date: {
            type: Date,
            default: Date.now
        },
        note: String
    }]
}, {
    timestamps: true
});

// Generate order number before saving
orderSchema.pre('save', function(next) {
    if (!this.orderNumber) {
        const timestamp = Date.now().toString();
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        this.orderNumber = `ORD-${timestamp.slice(-8)}-${random}`;
    }
    
    // Calculate item totals
    this.items.forEach(item => {
        item.total = item.price * item.quantity;
    });
    
    // Calculate subtotal
    this.pricing.subtotal = this.items.reduce((sum, item) => sum + item.total, 0);
    
    // Calculate total
    this.pricing.total = this.pricing.subtotal + this.pricing.tax + this.pricing.shipping - this.pricing.discount;
    
    next();
});

// Add status change to history
orderSchema.methods.updateStatus = function(newStatus, note = '') {
    this.status = newStatus;
    this.statusHistory.push({
        status: newStatus,
        note: note
    });
    return this.save();
};

// Index for searching orders
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ 'paymentInfo.status': 1 });

module.exports = mongoose.model('Order', orderSchema);