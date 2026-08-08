---
layout: base
title: Pago no completado
seoTitle: Pago no completado | Castanya de Viladrau
description: Retorno de error o cancelacion del pago de la tienda de Castanya de Viladrau.
permalink: /es/payment/error/
lang: es
---

<section class="shop-cart" aria-labelledby="payment-error-title">
  <div class="shop-cart__inner">
    <div class="shop-cart__main">
      <div class="shop-cart__heading">
        <span class="shop-cart__eyebrow">PAGO</span>
        <h1 id="payment-error-title" class="shop-cart__title">NO SE HA PODIDO COMPLETAR EL PAGO</h1>
        <p class="shop-cart__intro">
          Tu pedido puede haber quedado creado igualmente, pero el pago todavia no se ha confirmado.
        </p>
      </div>

      <article class="shop-cart-empty-card">
        <div class="shop-cart-empty-card__body">
          <p class="shop-cart-empty-card__kicker">PAGO PENDIENTE</p>
          <h2 class="shop-cart-empty-card__title">VUELVE A INTENTARLO O CONTACTA CON NOSOTROS</h2>
          <p class="shop-cart-empty-card__text">
            Revisa tu cesta y vuelve a iniciar el pago cuando quieras. Si el problema persiste, escribenos y te ayudaremos a recuperar el pedido.
          </p>
          <div class="shop-cart-empty-card__actions">
            <a href="/es/shop/cart/" class="btn-olive">VOLVER A LA CESTA</a>
            <a href="/es/contact/" class="shop-cart-empty-card__link">CONTACTAR</a>
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
