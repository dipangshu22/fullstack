// Main JavaScript for Fashion Store
document.addEventListener('DOMContentLoaded', function() {
    
    // Initialize Bootstrap tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Cart functionality
    class Cart {
        constructor() {
            this.cartCount = 0;
            this.init();
        }

        init() {
            this.bindEvents();
            this.updateCartCount();
        }

        bindEvents() {
            // Add to cart buttons
            document.addEventListener('click', (e) => {
                if (e.target.classList.contains('add-to-cart') || e.target.closest('.add-to-cart')) {
                    e.preventDefault();
                    const btn = e.target.classList.contains('add-to-cart') ? e.target : e.target.closest('.add-to-cart');
                    this.addToCart(btn);
                }
            });

            // Remove from cart buttons
            document.addEventListener('click', (e) => {
                if (e.target.classList.contains('remove-from-cart') || e.target.closest('.remove-from-cart')) {
                    e.preventDefault();
                    const btn = e.target.classList.contains('remove-from-cart') ? e.target : e.target.closest('.remove-from-cart');
                    this.removeFromCart(btn);
                }
            });

            // Update cart quantity
            document.addEventListener('change', (e) => {
                if (e.target.classList.contains('cart-quantity')) {
                    this.updateQuantity(e.target);
                }
            });
        }

        async addToCart(btn) {
            const productId = btn.dataset.productId;
            const size = btn.dataset.size || document.querySelector('input[name="size"]:checked')?.value;
            const color = btn.dataset.color || document.querySelector('input[name="color"]:checked')?.value;
            const quantity = parseInt(btn.dataset.quantity || document.querySelector('.quantity-input')?.value || 1);

            if (!size || !color) {
                this.showAlert('Please select size and color', 'warning');
                return;
            }

            try {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

                const response = await fetch('/api/cart/add', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        productId,
                        quantity,
                        size,
                        color
                    })
                });

                const data = await response.json();

                if (data.success) {
                    this.showAlert('Item added to cart!', 'success');
                    this.updateCartCount();
                    this.showCartPreview(data);
                } else {
                    this.showAlert(data.message || 'Failed to add item to cart', 'error');
                }
            } catch (error) {
                console.error('Error adding to cart:', error);
                this.showAlert('Failed to add item to cart', 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-shopping-cart"></i> Add to Cart';
            }
        }

        async removeFromCart(btn) {
            const productId = btn.dataset.productId;
            const size = btn.dataset.size;
            const color = btn.dataset.color;

            try {
                const response = await fetch('/api/cart/remove', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        productId,
                        size,
                        color
                    })
                });

                const data = await response.json();

                if (data.success) {
                    this.showAlert('Item removed from cart', 'success');
                    this.updateCartCount();
                    // Remove the item row if on cart page
                    const itemRow = btn.closest('.cart-item');
                    if (itemRow) {
                        itemRow.remove();
                    }
                    this.updateCartTotals();
                } else {
                    this.showAlert(data.message || 'Failed to remove item', 'error');
                }
            } catch (error) {
                console.error('Error removing from cart:', error);
                this.showAlert('Failed to remove item', 'error');
            }
        }

        async updateQuantity(input) {
            const productId = input.dataset.productId;
            const size = input.dataset.size;
            const color = input.dataset.color;
            const quantity = parseInt(input.value);

            if (quantity < 1) {
                input.value = 1;
                return;
            }

            try {
                const response = await fetch('/api/cart/update', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        productId,
                        quantity,
                        size,
                        color
                    })
                });

                const data = await response.json();

                if (data.success) {
                    this.updateCartTotals();
                } else {
                    this.showAlert(data.message || 'Failed to update quantity', 'error');
                    input.value = input.dataset.originalValue || 1;
                }
            } catch (error) {
                console.error('Error updating quantity:', error);
                this.showAlert('Failed to update quantity', 'error');
                input.value = input.dataset.originalValue || 1;
            }
        }

        async updateCartCount() {
            try {
                const response = await fetch('/api/cart');
                const data = await response.json();
                
                if (data.success) {
                    this.cartCount = data.data.count;
                    this.updateCartBadge();
                }
            } catch (error) {
                console.error('Error fetching cart count:', error);
            }
        }

        updateCartBadge() {
            const badge = document.querySelector('.cart-badge');
            if (badge) {
                if (this.cartCount > 0) {
                    badge.textContent = this.cartCount;
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                }
            }
        }

        async updateCartTotals() {
            try {
                const response = await fetch('/api/cart');
                const data = await response.json();
                
                if (data.success) {
                    const pricing = data.data.pricing;
                    document.querySelector('.subtotal')?.textContent = `$${pricing.subtotal.toFixed(2)}`;
                    document.querySelector('.tax')?.textContent = `$${pricing.tax.toFixed(2)}`;
                    document.querySelector('.shipping')?.textContent = `$${pricing.shipping.toFixed(2)}`;
                    document.querySelector('.total')?.textContent = `$${pricing.total.toFixed(2)}`;
                }
            } catch (error) {
                console.error('Error updating cart totals:', error);
            }
        }

        showCartPreview(data) {
            // Show a mini cart preview (can be enhanced)
            const toast = document.createElement('div');
            toast.className = 'toast position-fixed top-0 end-0 m-3';
            toast.innerHTML = `
                <div class="toast-header">
                    <strong class="me-auto">Added to Cart</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
                </div>
                <div class="toast-body">
                    Item successfully added to your cart!
                </div>
            `;
            document.body.appendChild(toast);
            const bsToast = new bootstrap.Toast(toast);
            bsToast.show();
        }

        showAlert(message, type = 'info') {
            const alertClass = type === 'error' ? 'alert-danger' : 
                             type === 'warning' ? 'alert-warning' : 
                             type === 'success' ? 'alert-success' : 'alert-info';
            
            const alert = document.createElement('div');
            alert.className = `alert ${alertClass} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
            alert.style.zIndex = '9999';
            alert.innerHTML = `
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            `;
            
            document.body.appendChild(alert);
            
            // Auto-dismiss after 5 seconds
            setTimeout(() => {
                if (alert.parentNode) {
                    alert.remove();
                }
            }, 5000);
        }
    }

    // Wishlist functionality
    class Wishlist {
        constructor() {
            this.init();
        }

        init() {
            this.bindEvents();
        }

        bindEvents() {
            document.addEventListener('click', (e) => {
                if (e.target.classList.contains('add-to-wishlist') || e.target.closest('.add-to-wishlist')) {
                    e.preventDefault();
                    const btn = e.target.classList.contains('add-to-wishlist') ? e.target : e.target.closest('.add-to-wishlist');
                    this.toggleWishlist(btn);
                }
            });
        }

        async toggleWishlist(btn) {
            const productId = btn.dataset.productId;
            const isInWishlist = btn.classList.contains('in-wishlist');

            try {
                const response = await fetch(`/api/users/wishlist${isInWishlist ? `/${productId}` : ''}`, {
                    method: isInWishlist ? 'DELETE' : 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: isInWishlist ? null : JSON.stringify({ productId })
                });

                const data = await response.json();

                if (response.status === 401) {
                    window.location.href = '/auth/login';
                    return;
                }

                if (data.success) {
                    btn.classList.toggle('in-wishlist');
                    const icon = btn.querySelector('i');
                    if (btn.classList.contains('in-wishlist')) {
                        icon.className = 'fas fa-heart';
                        btn.title = 'Remove from Wishlist';
                    } else {
                        icon.className = 'far fa-heart';
                        btn.title = 'Add to Wishlist';
                    }
                } else {
                    cart.showAlert(data.message || 'Failed to update wishlist', 'error');
                }
            } catch (error) {
                console.error('Error updating wishlist:', error);
                cart.showAlert('Failed to update wishlist', 'error');
            }
        }
    }

    // Search functionality
    class Search {
        constructor() {
            this.init();
        }

        init() {
            this.bindEvents();
        }

        bindEvents() {
            const searchForm = document.querySelector('form[role="search"]');
            if (searchForm) {
                searchForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const query = searchForm.querySelector('input').value.trim();
                    if (query) {
                        window.location.href = `/shop?search=${encodeURIComponent(query)}`;
                    }
                });
            }

            // Search suggestions (can be enhanced)
            const searchInput = document.querySelector('input[type="search"]');
            if (searchInput) {
                let debounceTimer;
                searchInput.addEventListener('input', (e) => {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        this.showSuggestions(e.target.value);
                    }, 300);
                });
            }
        }

        async showSuggestions(query) {
            if (query.length < 2) return;

            try {
                const response = await fetch(`/api/products/search/suggestions?q=${encodeURIComponent(query)}`);
                const data = await response.json();
                
                if (data.success && data.data.length > 0) {
                    // Show suggestions dropdown (implement UI)
                    console.log('Search suggestions:', data.data);
                }
            } catch (error) {
                console.error('Error fetching suggestions:', error);
            }
        }
    }

    // Product page functionality
    class ProductPage {
        constructor() {
            if (document.querySelector('.product-detail')) {
                this.init();
            }
        }

        init() {
            this.bindEvents();
        }

        bindEvents() {
            // Size selection
            document.addEventListener('change', (e) => {
                if (e.target.name === 'size') {
                    this.updateAvailableColors(e.target.value);
                }
            });

            // Color selection
            document.addEventListener('change', (e) => {
                if (e.target.name === 'color') {
                    this.updateProductImage(e.target.value);
                    this.updateStock(e.target.value);
                }
            });

            // Quantity controls
            document.addEventListener('click', (e) => {
                if (e.target.classList.contains('qty-btn')) {
                    e.preventDefault();
                    const input = e.target.parentNode.querySelector('.quantity-input');
                    const action = e.target.dataset.action;
                    let value = parseInt(input.value) || 1;
                    
                    if (action === 'increase') {
                        value++;
                    } else if (action === 'decrease' && value > 1) {
                        value--;
                    }
                    
                    input.value = value;
                }
            });
        }

        updateAvailableColors(selectedSize) {
            // Update available colors based on selected size
            const colorOptions = document.querySelectorAll('input[name="color"]');
            // Implementation depends on product data structure
        }

        updateProductImage(selectedColor) {
            // Update main product image based on selected color
            // Implementation depends on image structure
        }

        updateStock(selectedColor) {
            // Update stock information based on selection
            // Implementation depends on product data structure
        }
    }

    // Initialize all components
    const cart = new Cart();
    const wishlist = new Wishlist();
    const search = new Search();
    const productPage = new ProductPage();

    // Smooth scrolling for anchor links
    document.addEventListener('click', (e) => {
        if (e.target.matches('a[href^="#"]')) {
            e.preventDefault();
            const target = document.querySelector(e.target.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }
    });

    // Back to top button
    const backToTopBtn = document.createElement('button');
    backToTopBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    backToTopBtn.className = 'btn btn-primary position-fixed bottom-0 end-0 m-4 rounded-circle';
    backToTopBtn.style.display = 'none';
    backToTopBtn.style.zIndex = '9999';
    backToTopBtn.style.width = '50px';
    backToTopBtn.style.height = '50px';
    document.body.appendChild(backToTopBtn);

    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            backToTopBtn.style.display = 'block';
        } else {
            backToTopBtn.style.display = 'none';
        }
    });

    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    // Loading states
    window.showLoading = function(element) {
        element.disabled = true;
        element.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    };

    window.hideLoading = function(element, originalText) {
        element.disabled = false;
        element.innerHTML = originalText;
    };

    // Format currency
    window.formatCurrency = function(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    // Format date
    window.formatDate = function(date) {
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }).format(new Date(date));
    };

    // Global error handler
    window.addEventListener('error', (e) => {
        console.error('Global error:', e.error);
    });

    // Make cart globally accessible for other scripts
    window.cart = cart;
    window.wishlist = wishlist;
});