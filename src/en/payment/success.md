---
layout: base
title: Payment received
seoTitle: Payment received | Castanya de Viladrau
description: Confirmation of payment return from Castanya de Viladrau shop.
permalink: /en/payment/success/
lang: en
---

<section class="shop-cart" aria-labelledby="payment-success-title">
  <div class="shop-cart__inner">
    <div class="shop-cart__main">
      <div class="shop-cart__heading">
        <span class="shop-cart__eyebrow">PAYMENT</span>
        <h1 id="payment-success-title" class="shop-cart__title">PAYMENT CONFIRMED</h1>
        <p class="shop-cart__intro">
          We've received your payment and your order is now confirmed.
        </p>
      </div>

      <article class="shop-cart-empty-card">
        <div class="shop-cart-empty-card__body">
          <p class="shop-cart-empty-card__kicker">ORDER CONFIRMED</p>
          <h2 class="shop-cart-empty-card__title">THANK YOU FOR YOUR PURCHASE</h2>
          <p class="shop-cart-empty-card__text">
            You can go back to the shop or get in touch with us if you need any help.
          </p>
          <div class="shop-cart-empty-card__actions">
            <a href="/en/shop/products/" class="btn-olive">BACK TO SHOP</a>
            <a href="/en/contact/" class="shop-cart-empty-card__link">CONTACT US</a>
          </div>
        </div>
      </article>
    </div>
  </div>
</section>

<script>
  // Payment is confirmed server-side; clear any client-side cart remnants.
  try {
    window.localStorage.removeItem("castanya-cart");
    window.localStorage.removeItem("castanya-checkout-draft");
    window.localStorage.removeItem("castanya-checkout-session");
  } catch (e) {
    // ignore
  }
</script>
