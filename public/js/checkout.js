const {
  formatCurrency: formatCurrencyFn,
  getCart: getCartItems,
  saveCart: saveCartItems,
  getCartSubtotal: getCartSubtotalFn,
  calculateRentalCharge,
  updateCartCount: updateCartCountFn
} = window.CycleRide || {};

const DEPOSIT_AMOUNT = 500;

function populateCheckout() {
  const cartItems = getCartItems();
  const list = document.getElementById('checkout-items');
  const subtotal = getCartSubtotalFn();
  if (!list) return;

  if (cartItems.length === 0) {
    list.innerHTML = '<li class="empty-state">Choose a rental before booking your ride.</li>';
    const checkoutTotal = document.getElementById('checkout-total');
    if (checkoutTotal) checkoutTotal.textContent = formatCurrencyFn(0);
    const form = document.querySelector('form');
    if (form) form.classList.add('disabled');
    return;
  }

  list.innerHTML = cartItems.map((item) => `
    <li class="checkout-item">
      <span>${item.name}</span>
      <strong>${formatCurrencyFn(item.price * item.quantity)}</strong>
    </li>
  `).join('');

  const rentalDuration = parseInt(document.querySelector('input[name="duration"]')?.value || 1, 10);
  const rentalAmount = calculateRentalCharge(subtotal, rentalDuration);
  const totalWithDeposit = rentalAmount + DEPOSIT_AMOUNT;
  
  document.getElementById('checkout-total').textContent = formatCurrencyFn(totalWithDeposit);
}

let checkoutPageInitialized = false;

function initializeCheckoutPage() {
  if (checkoutPageInitialized) return;
  checkoutPageInitialized = true;

  populateCheckout();
  updateCartCountFn();

  const form = document.getElementById('checkout-form');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    const cartItems = getCartItems();
    const rentalHours = parseInt(payload.duration || '1', 10) || 1;
    
    payload.items = cartItems;
    payload.subtotal = getCartSubtotalFn();
    payload.rentalAmount = calculateRentalCharge(payload.subtotal, rentalHours);
    payload.deposit = DEPOSIT_AMOUNT;
    payload.total = payload.rentalAmount + DEPOSIT_AMOUNT;
    payload.subscriptionCost = 0;

    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Booking failed');
      saveCartItems([]);
      updateCartCountFn();
      const invoiceCard = document.getElementById('invoice-card');
      const invoiceNumber = document.getElementById('invoice-number');
      const invoicePayment = document.getElementById('invoice-payment');
      const invoiceCustomer = document.getElementById('invoice-customer');
      const invoiceTotal = document.getElementById('invoice-total');
      const customerName = payload.customerName || 'Guest';
      if (invoiceNumber) invoiceNumber.textContent = `Invoice: ${result.invoiceNumber}`;
      if (invoicePayment) invoicePayment.textContent = `Payment type: ${result.paymentMethod}`;
      if (invoiceCustomer) invoiceCustomer.textContent = `Customer: ${customerName}`;
      if (invoiceTotal) invoiceTotal.textContent = `Total paid: ${formatCurrencyFn(payload.total)}`;
      if (invoiceCard) invoiceCard.classList.remove('hidden');
      const orderMessage = document.getElementById('order-message');
      if (orderMessage) orderMessage.textContent = `${result.message} Booking ID: ${result.orderId}`;
      form.reset();
      populateCheckout();
    } catch (error) {
      document.getElementById('order-message').textContent = error.message;
    } finally {
      if (button) button.disabled = false;
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeCheckoutPage);
} else {
  initializeCheckoutPage();
}

window.addEventListener('load', initializeCheckoutPage);
