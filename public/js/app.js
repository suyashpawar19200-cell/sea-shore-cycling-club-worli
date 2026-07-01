const STORAGE_KEY = 'seashore-cart';

const PRODUCTS = [
  {
    id: 'sea-shore-rental',
    name: 'Sea Shore Cycling Club Rental',
    price: 250,
    category: 'Rental',
    description: 'Premium beachside bike hire with helmet, lock, and route guidance.',
    badge: 'Hourly Rental',
    deposit: 500
  }
];

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

function getCart() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to read cart', error);
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
}

function addToCart(productId, quantity = 1) {
  const cart = getCart();
  const existing = cart.find((item) => item.id === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    const product = PRODUCTS.find((item) => item.id === productId);
    if (!product) return;
    cart.push({ ...product, quantity });
  }
  saveCart(cart);
  updateCartCount();
  if (window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent('cart:updated'));
  }
}

function updateQuantity(productId, change) {
  const cart = getCart();
  const existing = cart.find((item) => item.id === productId);
  if (!existing) return cart;
  existing.quantity += change;
  if (existing.quantity <= 0) {
    const index = cart.findIndex((item) => item.id === productId);
    cart.splice(index, 1);
  }
  saveCart(cart);
  updateCartCount();
  if (window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent('cart:updated'));
  }
  return cart;
}

function removeFromCart(productId) {
  const cart = getCart().filter((item) => item.id !== productId);
  saveCart(cart);
  updateCartCount();
  if (window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent('cart:updated'));
  }
  return cart;
}

function clearCart() {
  saveCart([]);
  updateCartCount();
  if (window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent('cart:updated'));
  }
  return [];
}

function getCartCount() {
  return getCart().reduce((count, item) => count + item.quantity, 0);
}

function getCartSubtotal() {
  return getCart().reduce((total, item) => total + item.price * item.quantity, 0);
}

function updateCartCount() {
  const count = getCartCount();
  document.querySelectorAll('[data-cart-count]').forEach((el) => {
    el.textContent = count;
  });
}

function attachAddToCartButtons() {
  document.querySelectorAll('[data-add-to-cart]').forEach((button) => {
    if (button.dataset.bound === 'true') return;
    button.dataset.bound = 'true';
    button.addEventListener('click', () => {
      addToCart(button.dataset.addToCart, 1);
      button.textContent = 'Added';
      button.disabled = true;
      setTimeout(() => {
        button.textContent = 'Book now';
        button.disabled = false;
      }, 800);
    });
  });
}

window.CycleRide = {
  PRODUCTS,
  formatCurrency,
  getCart,
  saveCart,
  addToCart,
  updateQuantity,
  removeFromCart,
  clearCart,
  getCartCount,
  getCartSubtotal,
  updateCartCount,
  attachAddToCartButtons
};

document.addEventListener('DOMContentLoaded', () => {
  updateCartCount();
  attachAddToCartButtons();
});
