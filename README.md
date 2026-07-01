# CycleRide - Premium Cycling Brand Website

A complete e-commerce cycling brand website with product catalog, shopping cart, checkout, and contact form.

## Features

✅ **Product Catalog** - Browse bikes, accessories, and apparel with filtering
✅ **Shopping Cart** - Add/remove items with quantity management
✅ **E-commerce Checkout** - Secure order processing with validation
✅ **Contact Form** - Customer contact and support requests
✅ **Responsive Design** - Mobile-friendly layout
✅ **Order Management** - Backend order storage

## Project Structure

```
cycling-website/
├── public/
│   ├── index.html          # Home page
│   ├── products.html       # Product catalog
│   ├── cart.html          # Shopping cart
│   ├── checkout.html      # Checkout page
│   ├── contact.html       # Contact form
│   ├── css/
│   │   └── styles.css     # Main stylesheet
│   ├── js/
│   │   ├── app.js         # Main app logic & cart management
│   │   ├── cart.js        # Cart page functionality
│   │   ├── checkout.js    # Checkout functionality
│   │   └── contact.js     # Contact form handling
│   └── images/            # Product images (if needed)
├── server.js              # Express backend server
├── package.json           # Dependencies
└── README.md              # This file
```

## Installation

1. **Navigate to project folder:**
   ```bash
   cd cycling-website
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Open in browser:**
   ```
   http://localhost:3000
   ```

## Usage

### Home Page
- Browse featured products
- Subscribe to newsletter
- View company info

### Products Page
- View full product catalog
- Filter by category (Bikes, Accessories, Apparel)
- Add items to cart

### Shopping Cart
- View all cart items
- Update quantities
- Remove items
- Proceed to checkout

### Checkout
- Enter billing information
- Enter payment details
- Place order
- Receive confirmation with order ID

### Contact
- Send messages to support
- View contact information
- Check frequently asked questions

## Products Available

**Bikes:**
- Mountain Bike Pro - $1,299
- Road Bike Elite - $1,599
- City Commuter - $699

**Accessories:**
- Cycling Backpack - $79
- LED Light Set - $39
- Tool Kit Pro - $49
- Premium Lock - $59

**Apparel:**
- Cycling Jersey - $45
- Padded Shorts - $85
- Premium Gloves - $49
- Sports Sunglasses - $129

## API Endpoints

### POST /api/checkout
Process orders
- Body: Customer info, items, total
- Response: Order ID and confirmation

### POST /api/contact
Submit contact form
- Body: Name, email, subject, message
- Response: Success confirmation

### GET /api/orders
Retrieve all orders (for admin)

### GET /api/messages
Retrieve all messages (for admin)

## Technologies Used

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express
- **Storage**: LocalStorage (client), In-memory (server)

## Features Demo

1. **Add to Cart**: Click "Add to Cart" on any product
2. **View Cart**: Click cart icon to see items
3. **Checkout**: Enter shipping and payment info
4. **Contact**: Fill out contact form for support
5. **Responsive**: Resize window to see mobile layout

## Future Enhancements

- Database integration (MongoDB, PostgreSQL)
- User authentication & accounts
- Product reviews & ratings
- Payment gateway integration (Stripe, PayPal)
- Email notifications
- Admin dashboard
- Inventory management
- Search functionality
- Product recommendations

## Development Notes

- Cart data stored in browser localStorage
- Orders stored in server memory (resets on restart)
- Test payment card: 1234 5678 9012 3456
- All prices in USD

## Support

For issues or questions:
- Email: info@cycleride.com
- Phone: 1-800-CYCLE-1
- Contact form on website

---
Created 2024 • CycleRide
