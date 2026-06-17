---
layout: base
title: Pagament no completat
seoTitle: Pagament no completat | Castanya de Viladrau
description: Retorn d'error o cancel-lacio del pagament de la botiga de Castanya de Viladrau.
permalink: /payment/error/
---

<section class="shop-cart" aria-labelledby="payment-error-title">
  <div class="shop-cart__inner">
    <div class="shop-cart__main">
      <div class="shop-cart__heading">
        <span class="shop-cart__eyebrow">PAGAMENT</span>
        <h1 id="payment-error-title" class="shop-cart__title">NO S'HA POGUT COMPLETAR EL PAGAMENT</h1>
        <p class="shop-cart__intro">
          La teva comanda pot haver quedat creada igualment, pero el pagament no s'ha confirmat encara.
        </p>
      </div>

      <article class="shop-cart-empty-card">
        <div class="shop-cart-empty-card__body">
          <p class="shop-cart-empty-card__kicker">PAGAMENT PENDENT</p>
          <h2 class="shop-cart-empty-card__title">TORNA A INTENTAR-HO O CONTACTA AMB NOSALTRES</h2>
          <p class="shop-cart-empty-card__text">
            Revisa la teva cistella i torna a iniciar el pagament quan vulguis. Si el problema persisteix, escriu-nos i t'ajudarem a recuperar la comanda.
          </p>
          <div class="shop-cart-empty-card__actions">
            <a href="/shop/cart/" class="btn-olive">TORNAR A LA CISTELLA</a>
            <a href="/contact/" class="shop-cart-empty-card__link">CONTACTAR</a>
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
