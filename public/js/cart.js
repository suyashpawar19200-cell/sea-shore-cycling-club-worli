const {
  formatCurrency: formatCurrencyFn,
  getCart: getCartItems,
  updateQuantity: updateQuantityFn,
  removeFromCart: removeFromCartFn,
  clearCart: clearCartFn,
  getCartSubtotal: getCartSubtotalFn,
  updateCartCount: updateCartCountFn
} = window.CycleRide;

function bindCartActions() {
  document.querySelectorAll('[data-remove]').forEach((button) => {
    button.onclick = () => {
      removeFromCartFn(button.dataset.remove);
      renderCart();
    };
  });

  document.querySelectorAll('.quantity-btn').forEach((button) => {
    button.onclick = () => {
      updateQuantityFn(button.dataset.id, button.dataset.action === 'increase' ? 1 : -1);
      renderCart();
    };
  });

  const clearButton = document.getElementById('clear-cart-btn');
  if (clearButton) {
    clearButton.onclick = () => {
      clearCartFn();
      renderCart();
    };
  }
}

function renderCart() {
  const cartItems = getCartItems();
  const container = document.getElementById('cart-items');
  const summary = document.getElementById('cart-summary');
  if (!container || !summary) return;

  if (cartItems.length === 0) {
    container.innerHTML = '<div class="empty-state">Your ride plan is empty. Start with a premium rental booking.</div>';
    summary.innerHTML = '<p class="muted">No rental selected yet.</p>';
    return;
  }

  container.innerHTML = cartItems.map((item) => `
    <div class="cart-item">
      <div>
        <h3>${item.name}</h3>
        <p>${item.description}</p>
        <p class="muted">${formatCurrencyFn(item.price)} for the first 2 hours</p>
      </div>
      <div class="cart-actions">
        <div class="quantity-controls">
          <button class="quantity-btn" data-action="decrease" data-id="${item.id}">-</button>
          <span>${item.quantity}</span>
          <button class="quantity-btn" data-action="increase" data-id="${item.id}">+</button>
        </div>
        <div class="price">${formatCurrencyFn(item.price * item.quantity)}</div>
        <button class="remove-btn" data-remove="${item.id}">Remove</button>
      </div>
    </div>
  `).join('');

  const subtotal = getCartSubtotalFn();
  summary.innerHTML = `
    <div class="summary-row"><span>Rental rate</span><strong>${formatCurrencyFn(subtotal)}</strong></div>
    <div class="summary-row"><span>Refundable deposit</span><strong>${formatCurrencyFn(500)}</strong></div>
    <div class="summary-row total"><span>Amount due</span><strong>${formatCurrencyFn(subtotal + 500)}</strong></div>
    <a href="/billing" class="btn btn-primary wide">Continue to booking</a>
    <button type="button" class="btn btn-secondary wide" id="clear-cart-btn">Cancel all rentals</button>
  `;

  bindCartActions();
}

let cartPageInitialized = false;

function initializeCartPage() {
  if (cartPageInitialized) return;
  cartPageInitialized = true;

  renderCart();
  updateCartCountFn();
  window.addEventListener('cart:updated', renderCart);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeCartPage);
} else {
  initializeCartPage();
}

window.addEventListener('load', initializeCartPage);
window.CycleRide.renderCart = renderCart;
