---
layout: base
title: Pago recibido
seoTitle: Pago recibido | Castanya de Viladrau
description: Confirmacion de retorno de pago de la tienda de Castanya de Viladrau.
permalink: /es/payment/success/
lang: es
---

<section class="shop-cart" aria-labelledby="payment-success-title">
  <div class="shop-cart__inner">
    <div class="shop-cart__main">
      <div class="shop-cart__heading">
        <span class="shop-cart__eyebrow">PAGO</span>
        <h1 id="payment-success-title" class="shop-cart__title">PAGO CONFIRMADO</h1>
        <p class="shop-cart__intro">
          Hemos recibido tu pago y el pedido ya esta confirmado.
        </p>
      </div>

      <article class="shop-cart-empty-card">
        <div class="shop-cart-empty-card__body">
          <p class="shop-cart-empty-card__kicker">PEDIDO CONFIRMADO</p>
          <h2 class="shop-cart-empty-card__title">GRACIAS POR TU COMPRA</h2>
          <p class="shop-cart-empty-card__text">
            Puedes volver a la tienda o ponerte en contacto con nosotros si necesitas ayuda.
          </p>
          <div class="shop-cart-empty-card__actions">
            <a href="/es/shop/products/" class="btn-olive">VOLVER A LA TIENDA</a>
            <a href="/es/contact/" class="shop-cart-empty-card__link">CONTACTAR</a>
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
