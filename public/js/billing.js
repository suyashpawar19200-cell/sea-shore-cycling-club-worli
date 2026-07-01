const {
  formatCurrency: formatCurrencyFn,
  getCart: getCartItems,
  saveCart: saveCartItems,
  getCartSubtotal: getCartSubtotalFn,
  updateCartCount: updateCartCountFn
} = window.CycleRide;

const DEPOSIT_AMOUNT = 500;
const BOOKING_DRAFT_STORAGE_KEY = 'cycleride-booking-draft';

let bookingDraft = {};
let billingPageInitialized = false;

function populateBillingSummary() {
  const cartItems = getCartItems();
  const subtotal = getCartSubtotalFn();
  const itemsContainer = document.getElementById('billing-items');
  const durationInput = document.querySelector('input[name="duration"]');
  const rentalDuration = parseInt(durationInput?.value || bookingDraft.duration || 1, 10);

  if (!itemsContainer) return;

  const baseRentalAmount = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
  const rentalAmount = baseRentalAmount * rentalDuration;
  const total = rentalAmount + DEPOSIT_AMOUNT;

  itemsContainer.innerHTML = cartItems.length > 0
    ? cartItems.map((item) => `
        <li class="billing-item">
          <span>${item.name} × ${item.quantity}</span>
          <strong>${formatCurrencyFn(item.price * item.quantity)}</strong>
        </li>
      `).join('')
    : '<li class="empty-state">No rental items selected</li>';

  document.getElementById('subtotal-amount').textContent = formatCurrencyFn(subtotal);
  document.getElementById('rental-amount').textContent = formatCurrencyFn(rentalAmount);
  document.getElementById('deposit-amount').textContent = formatCurrencyFn(DEPOSIT_AMOUNT);
  document.getElementById('total-amount').textContent = formatCurrencyFn(total);
}

function updatePaymentInfo() {
  const paymentMethod = document.getElementById('payment-method')?.value || '';
  const noteElement = document.getElementById('payment-note');

  if (paymentMethod === 'cash') {
    noteElement.textContent = 'Payment will be made in cash at pickup.';
    noteElement.style.display = 'block';
  } else if (paymentMethod === 'upi') {
    noteElement.textContent = 'A UPI payment link will be shared after confirmation.';
    noteElement.style.display = 'block';
  } else {
    noteElement.style.display = 'none';
  }
}

function syncBookingDraftFromForm() {
  const infoForm = document.getElementById('booking-info-form');
  if (!infoForm) return;

  const formData = new FormData(infoForm);
  bookingDraft = { ...bookingDraft, ...Object.fromEntries(formData.entries()) };
  bookingDraft.duration = parseInt(bookingDraft.duration || 1, 10);
  saveDraft();
  renderBookingSummary();
  populateBillingSummary();
}

function showStep(stepNumber) {
  document.querySelectorAll('.booking-step').forEach((step) => step.classList.add('hidden'));
  document.querySelectorAll('[data-step-pill]').forEach((pill) => {
    pill.classList.toggle('active', Number(pill.dataset.stepPill) === stepNumber);
  });

  const activeStep = document.getElementById(`step-${stepNumber === 1 ? 'info' : stepNumber === 2 ? 'payment' : 'billing'}`);
  if (activeStep) activeStep.classList.remove('hidden');
}

function renderBookingSummary() {
  document.getElementById('summary-name').textContent = bookingDraft.customerName || '-';
  document.getElementById('summary-phone').textContent = bookingDraft.phone || '-';
  document.getElementById('summary-datetime').textContent = bookingDraft.rentalDate && bookingDraft.rentalTime
    ? `${bookingDraft.rentalDate} at ${bookingDraft.rentalTime}`
    : '-';
  document.getElementById('summary-pickup').textContent = bookingDraft.pickupLocation || '-';
}

function saveDraft() {
  localStorage.setItem(BOOKING_DRAFT_STORAGE_KEY, JSON.stringify(bookingDraft));
}

function restoreDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(BOOKING_DRAFT_STORAGE_KEY) || '{}');
    bookingDraft = saved;
    if (saved.customerName) {
      const form = document.getElementById('booking-info-form');
      if (form) {
        new FormData(form).forEach((_, key) => {
          const field = form.elements[key];
          if (field && saved[key] !== undefined) {
            field.value = saved[key];
          }
        });
      }
    }
  } catch (error) {
    console.error('Could not restore booking draft', error);
  }
}

function initializeBillingPage() {
  if (billingPageInitialized) return;
  billingPageInitialized = true;

  updateCartCountFn();
  populateBillingSummary();
  restoreDraft();
  renderBookingSummary();
  showStep(1);
  updatePaymentInfo();

  const infoForm = document.getElementById('booking-info-form');
  if (infoForm) {
    infoForm.addEventListener('input', syncBookingDraftFromForm);
    infoForm.addEventListener('change', syncBookingDraftFromForm);
    infoForm.addEventListener('submit', (event) => {
      event.preventDefault();
      syncBookingDraftFromForm();
      showStep(2);
    });
  }

  const paymentMethodSelect = document.getElementById('payment-method');
  if (paymentMethodSelect) {
    paymentMethodSelect.addEventListener('change', updatePaymentInfo);
  }

  window.addEventListener('cart:updated', populateBillingSummary);

  const backButton = document.getElementById('back-to-info');
  if (backButton) {
    backButton.addEventListener('click', () => showStep(1));
  }

  const confirmButton = document.getElementById('confirm-payment');
  if (confirmButton) {
    confirmButton.addEventListener('click', async () => {
      const cartItems = getCartItems();
      const messageBox = document.getElementById('billing-message');

      if (cartItems.length === 0) {
        messageBox.textContent = 'Please add items to your cart before booking.';
        messageBox.style.color = 'red';
        return;
      }

      const paymentMethod = document.getElementById('payment-method')?.value;
      if (!paymentMethod) {
        messageBox.textContent = 'Please choose a payment method.';
        messageBox.style.color = 'red';
        return;
      }

      const rentalDuration = parseInt(bookingDraft.duration || 1, 10);
      const subtotal = getCartSubtotalFn();
      const rentalAmount = subtotal * rentalDuration;
      const payload = {
        ...bookingDraft,
        paymentMethod,
        items: cartItems,
        subtotal,
        rentalAmount,
        deposit: DEPOSIT_AMOUNT,
        tax: 0,
        total: rentalAmount + DEPOSIT_AMOUNT
      };

      confirmButton.disabled = true;
      messageBox.textContent = 'Processing your booking...';
      messageBox.style.color = '';

      try {
        const response = await fetch('/api/billing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Booking failed');

        document.getElementById('confirm-invoice').textContent = result.invoiceNumber;
        document.getElementById('confirm-booking-id').textContent = result.orderId;
        document.getElementById('confirm-name').textContent = payload.customerName;
        document.getElementById('confirm-datetime').textContent = `${payload.rentalDate} at ${payload.rentalTime}`;
        document.getElementById('confirm-payment-method').textContent = paymentMethod.toUpperCase();
        document.getElementById('confirm-status').textContent = result.status || 'Confirmed';
        document.getElementById('confirm-total').textContent = formatCurrencyFn(result.total || payload.total || 0);

        saveCartItems([]);
        updateCartCountFn();
        messageBox.textContent = result.message;
        showStep(3);
      } catch (error) {
        messageBox.textContent = `Error: ${error.message}`;
        messageBox.style.color = 'red';
      } finally {
        confirmButton.disabled = false;
      }
    });
  }

  const durationInput = document.querySelector('input[name="duration"]');
  if (durationInput) {
    durationInput.addEventListener('input', populateBillingSummary);
    durationInput.addEventListener('change', populateBillingSummary);
  }

  window.addEventListener('load', populateBillingSummary);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeBillingPage);
} else {
  initializeBillingPage();
}

window.addEventListener('load', initializeBillingPage);
