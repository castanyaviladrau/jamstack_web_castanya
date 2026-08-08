---
layout: base
title: Payment not completed
seoTitle: Payment not completed | Castanya de Viladrau
description: Error or cancellation return from Castanya de Viladrau shop payment.
permalink: /en/payment/error/
lang: en
---

<section class="shop-cart" aria-labelledby="payment-error-title">
  <div class="shop-cart__inner">
    <div class="shop-cart__main">
      <div class="shop-cart__heading">
        <span class="shop-cart__eyebrow">PAYMENT</span>
        <h1 id="payment-error-title" class="shop-cart__title">WE COULDN'T COMPLETE YOUR PAYMENT</h1>
        <p class="shop-cart__intro">
          Your order may have been created regardless, but the payment has not been confirmed yet.
        </p>
      </div>

      <article class="shop-cart-empty-card">
        <div class="shop-cart-empty-card__body">
          <p class="shop-cart-empty-card__kicker">PAYMENT PENDING</p>
          <h2 class="shop-cart-empty-card__title">TRY AGAIN OR GET IN TOUCH WITH US</h2>
          <p class="shop-cart-empty-card__text">
            Check your basket and restart the payment whenever you like. If the problem persists, write to us and we'll help you recover your order.
          </p>
          <div class="shop-cart-empty-card__actions">
            <a href="/en/shop/cart/" class="btn-olive">BACK TO BASKET</a>
            <a href="/en/contact/" class="shop-cart-empty-card__link">CONTACT US</a>
          </div>
        </div>
      </article>
    </div>
  </div>
</section>

<script>
  // Keep cart contents, but force a fresh checkout/order on payment retry.
  try {
    window.localStorage.removeItem("castanya-checkout-session");
  } catch (e) {
    // ignore
  }
</script>
