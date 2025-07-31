# Fashion Store - Full Stack Ecommerce Website

A complete full-stack ecommerce website for clothing, built with Node.js, Express, MongoDB, and modern frontend technologies.

## 🚀 Features

### User Features
- **User Authentication** - Registration, login, logout with session management
- **Product Catalog** - Browse products with filtering, sorting, and search
- **Shopping Cart** - Add/remove items, update quantities, persistent cart
- **Wishlist** - Save favorite products for later
- **Order Management** - Place orders, track order status, order history
- **User Profile** - Update personal information, address management
- **Responsive Design** - Mobile-friendly interface

### Admin Features
- **Admin Dashboard** - Overview of sales, orders, and statistics
- **Product Management** - Add, edit, delete products with image upload
- **Category Management** - Organize products into categories
- **Order Management** - Process orders, update shipping status
- **User Management** - View and manage user accounts
- **File Upload** - Image upload for products

### Technical Features
- **RESTful API** - Well-structured API endpoints
- **Session Management** - Secure user sessions with MongoDB store
- **File Upload** - Image upload with Multer
- **Data Validation** - Input validation with Express Validator
- **Security** - Helmet, CORS, password hashing with bcrypt
- **Modern UI** - Bootstrap 5, Font Awesome icons
- **Database** - MongoDB with Mongoose ODM

## 🛠️ Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **Express Session** - Session management
- **Bcrypt** - Password hashing
- **Multer** - File upload middleware
- **JSON Web Tokens** - API authentication
- **Express Validator** - Input validation

### Frontend
- **EJS** - Template engine
- **Bootstrap 5** - CSS framework
- **Font Awesome** - Icons
- **Vanilla JavaScript** - Frontend interactions

## 📋 Prerequisites

Before running this application, make sure you have the following installed:

- [Node.js](https://nodejs.org/) (v14 or higher)
- [MongoDB](https://www.mongodb.com/) (v4.4 or higher)
- [npm](https://www.npmjs.com/) (comes with Node.js)

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd clothing-ecommerce
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory and update the values:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/clothing-ecommerce
DB_NAME=clothing-ecommerce

# Server
PORT=8810
NODE_ENV=development

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=7d

# Session
SESSION_SECRET=your-super-secret-session-key-change-this-in-production

# Email (for notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Stripe (for payments)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key

# File Upload
MAX_FILE_SIZE=5000000
UPLOAD_PATH=./public/uploads/
```

### 4. Start MongoDB
Make sure MongoDB is running on your system:

```bash
# On macOS with Homebrew
brew services start mongodb-community

# On Ubuntu/Debian
sudo systemctl start mongod

# On Windows
net start MongoDB
```

### 5. Seed the Database
Populate the database with sample data:

```bash
npm run seed
```

This will create:
- Sample categories (Men's Clothing, Women's Clothing, etc.)
- Sample products with variants (sizes, colors, stock)
- Admin user: `admin@fashionstore.com` / `admin123`
- Demo user: `demo@fashionstore.com` / `demo123`

### 6. Start the Application
```bash
# Development mode with nodemon
npm run dev

# Production mode
npm start
```

The application will be available at `http://localhost:8810`

## 👥 Default Users

After seeding the database, you can login with:

**Admin User:**
- Email: `admin@fashionstore.com`
- Password: `admin123`
- Access: Admin panel, all features

**Demo User:**
- Email: `demo@fashionstore.com`
- Password: `demo123`
- Access: Customer features

## 📱 Usage

### Customer Features

1. **Browse Products**
   - Visit the homepage to see featured products
   - Use the shop page to browse all products
   - Filter by category, price, size, color, or brand
   - Search for specific products

2. **Shopping Cart**
   - Add products to cart with size and color selection
   - Update quantities or remove items
   - View cart totals including tax and shipping

3. **User Account**
   - Register for a new account or login
   - Update profile information and address
   - View order history and order details
   - Manage wishlist

4. **Place Orders**
   - Add items to cart and proceed to checkout
   - Enter shipping and billing information
   - Choose payment method
   - Receive order confirmation

### Admin Features

1. **Admin Dashboard**
   - Access via `/admin/dashboard` (admin login required)
   - View sales statistics and recent orders
   - Monitor low stock products

2. **Product Management**
   - Add new products with images and variants
   - Edit existing product information
   - Manage product categories
   - Upload product images

3. **Order Management**
   - View all customer orders
   - Update order status and shipping information
   - Process refunds and cancellations

4. **User Management**
   - View registered users
   - Change user roles
   - Activate/deactivate accounts

## 🔧 API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /auth/logout` - User logout

### Products
- `GET /api/products` - Get all products (with filters)
- `GET /api/products/featured` - Get featured products
- `GET /api/products/:slug` - Get single product
- `POST /api/products` - Create product (admin)
- `PUT /api/products/:id` - Update product (admin)
- `DELETE /api/products/:id` - Delete product (admin)

### Cart
- `GET /api/cart` - Get cart contents
- `POST /api/cart/add` - Add item to cart
- `PUT /api/cart/update` - Update cart item
- `DELETE /api/cart/remove` - Remove item from cart

### Orders
- `GET /api/orders` - Get user orders
- `POST /api/orders` - Create new order
- `GET /api/orders/:orderNumber` - Get order details

### Categories
- `GET /api/categories` - Get all categories
- `GET /api/categories/:slug` - Get category with products
- `POST /api/categories` - Create category (admin)

## 📁 Project Structure

```
clothing-ecommerce/
├── app.js                 # Main application file
├── package.json           # Dependencies and scripts
├── .env                   # Environment variables
├── README.md              # Project documentation
├── public/                # Static files
│   ├── css/              # Custom CSS
│   ├── js/               # Frontend JavaScript
│   ├── images/           # Static images
│   └── uploads/          # Uploaded files
├── src/
│   ├── config/           # Configuration files
│   │   └── database.js   # Database connection
│   ├── controller/       # Route controllers
│   │   ├── authController.js
│   │   ├── productController.js
│   │   ├── cartController.js
│   │   ├── orderController.js
│   │   ├── userController.js
│   │   ├── categoryController.js
│   │   └── adminController.js
│   ├── middleware/       # Custom middleware
│   │   └── auth.js       # Authentication middleware
│   ├── models/           # Database models
│   │   ├── User.js
│   │   ├── Product.js
│   │   ├── Category.js
│   │   └── Order.js
│   ├── utils/            # Utility functions
│   │   └── seedData.js   # Database seeding script
│   └── views/            # EJS templates
│       ├── index.ejs     # Homepage
│       ├── auth/         # Authentication pages
│       └── admin/        # Admin panel pages
```

## 🔐 Security Features

- **Password Hashing** - Bcrypt for secure password storage
- **Session Management** - Secure sessions with MongoDB store
- **Input Validation** - Express Validator for all inputs
- **CORS Protection** - Configured CORS policy
- **Helmet** - Security headers
- **File Upload Security** - File type and size validation

## 🎨 Customization

### Styling
- Modify `public/css/style.css` for custom styles
- Update CSS variables in `:root` for color scheme
- Bootstrap 5 classes available throughout

### Frontend Functionality
- Edit `public/js/main.js` for custom JavaScript
- Add new features to cart, wishlist, or search functionality

### Backend Features
- Add new API endpoints in respective controllers
- Create new middleware in `src/middleware/`
- Extend database models as needed

## 🚀 Deployment

### Environment Setup
1. Set `NODE_ENV=production` in production
2. Use a cloud MongoDB service (MongoDB Atlas)
3. Configure proper environment variables
4. Set up SSL/HTTPS

### Recommended Platforms
- **Heroku** - Easy deployment with MongoDB Atlas
- **DigitalOcean** - VPS with full control
- **AWS EC2** - Scalable cloud infrastructure
- **Vercel/Netlify** - For frontend-only deployments

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the ISC License.

## 📞 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the code comments

## 🙏 Acknowledgments

- Bootstrap team for the amazing CSS framework
- MongoDB team for the database
- Express.js team for the web framework
- All open source contributors

---

**Happy Coding! 🛍️**