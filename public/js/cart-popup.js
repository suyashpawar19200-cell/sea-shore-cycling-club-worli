// Cart Popup Modal System
const CartModal = {
  showOrderDetails() {
    const cart = window.CycleRide?.getCart?.() || [];
    const subtotal = window.CycleRide?.getCartSubtotal?.() || 0;
    const formatCurrency = window.CycleRide?.formatCurrency || ((v) => v);
    
    if (cart.length === 0) {
      alert('Your cart is empty. Please add items before checkout.');
      return;
    }

    const items = cart.map(item => `
      <div style="padding: 10px 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between;">
        <div>
          <strong>${item.name}</strong><br/>
          <small>Quantity: ${item.quantity}</small>
        </div>
        <div style="text-align: right;">
          <strong>${formatCurrency(item.price * item.quantity)}</strong>
        </div>
      </div>
    `).join('');

    const deposit = 500;
    const total = subtotal + deposit;
    const modalHTML = `
      <div id="cart-modal-overlay" style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
      ">
        <div style="
          background: white;
          border-radius: 12px;
          padding: 24px;
          max-width: 500px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0;">Order Summary</h2>
            <button onclick="document.getElementById('cart-modal-overlay')?.remove()" style="
              background: none;
              border: none;
              font-size: 24px;
              cursor: pointer;
              color: #999;
            ">×</button>
          </div>

          <div style="margin-bottom: 20px;">
            <h3>Order Items (${cart.length})</h3>
            ${items}
          </div>

          <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span>Rental Items Subtotal:</span>
              <strong>${formatCurrency(subtotal)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span>Security Deposit (Refundable):</span>
              <strong>${formatCurrency(deposit)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 2px solid #ddd; padding-top: 8px; font-size: 16px; font-weight: bold;">
              <span>Total Amount:</span>
              <strong style="color: #0f4c5c;">${formatCurrency(total)}</strong>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <button onclick="document.getElementById('cart-modal-overlay')?.remove()" style="
              padding: 12px;
              border: 1px solid #ddd;
              background: white;
              border-radius: 8px;
              cursor: pointer;
              font-weight: bold;
            ">Continue Shopping</button>
            <a href="/billing" style="
              padding: 12px;
              background: #0f4c5c;
              color: white;
              border-radius: 8px;
              cursor: pointer;
              font-weight: bold;
              text-align: center;
              text-decoration: none;
            ">Proceed to Billing</a>
          </div>
        </div>
      </div>
    `;

    // Remove existing modal if any
    document.getElementById('cart-modal-overlay')?.remove();
    
    // Create and insert modal
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalHTML;
    document.body.appendChild(tempDiv.firstElementChild);
  }
};

// Make it globally accessible
window.CartModal = CartModal;
