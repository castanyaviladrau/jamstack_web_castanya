---
layout: base
title: Pagament rebut
seoTitle: Pagament rebut | Castanya de Viladrau
description: Confirmacio de retorn de pagament de la botiga de Castanya de Viladrau.
permalink: /payment/success/
---

<section class="shop-cart" aria-labelledby="payment-success-title">
  <div class="shop-cart__inner">
    <div class="shop-cart__main">
      <div class="shop-cart__heading">
        <span class="shop-cart__eyebrow">PAGAMENT</span>
        <h1 id="payment-success-title" class="shop-cart__title">PAGAMENT CONFIRMAT</h1>
        <p class="shop-cart__intro">
          Hem rebut el teu pagament i la comanda ja esta confirmada.
        </p>
      </div>

      <article class="shop-cart-empty-card">
        <div class="shop-cart-empty-card__body">
          <p class="shop-cart-empty-card__kicker">COMANDA CONFIRMADA</p>
          <h2 class="shop-cart-empty-card__title">GRACIES PER LA TEVA COMPRA</h2>
          <p class="shop-cart-empty-card__text">
            Pots tornar a la botiga o posar-te en contacte amb nosaltres si necessites ajuda.
          </p>
          <div class="shop-cart-empty-card__actions">
            <a href="/shop/products/" class="btn-olive">TORNAR A LA BOTIGA</a>
            <a href="/contact/" class="shop-cart-empty-card__link">CONTACTAR</a>
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
