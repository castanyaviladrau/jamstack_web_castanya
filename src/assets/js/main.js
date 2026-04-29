document.addEventListener("DOMContentLoaded", () => {
  const header = document.querySelector(".site-header");
  const heroImg = document.querySelector(".hero-img");
  const hasClimbHeader =
    document.body.classList.contains("home") ||
    document.body.classList.contains("page-fusta") ||
    document.body.classList.contains("page-visits");

  const handleScroll = () => {
    if (!header) {
      return;
    }

    if (!hasClimbHeader) {
      // On internal pages, we just ensure the scrolled class is present for styling
      header.classList.add("is-scrolled");
      document.documentElement.style.setProperty("--climb-progress", "1");
      return;
    }

    const scrollPos = window.scrollY;
    const vh = window.innerHeight;
    const navHeight = 65; // Height of your menu bar

    // Calculate 0 to 1 progress based on scroll
    const dockingDistance = vh - navHeight;
    let progress = Math.min(scrollPos / dockingDistance, 1);

    // Send progress to CSS
    document.documentElement.style.setProperty("--climb-progress", progress);

    // Toggle solid color when it reaches the very top
    if (progress >= 1) {
      header.classList.add("is-scrolled");
    } else {
      header.classList.remove("is-scrolled");
    }

    // Optional: Fade out the background image slightly
    if (heroImg) {
      heroImg.style.opacity = Math.max(1 - scrollPos / vh, 0);
    }
  };

  window.addEventListener("scroll", handleScroll, { passive: true });
  handleScroll(); // Run immediately on load

  // --- CAROUSEL LOGIC ---
  const scrollContainer = document.getElementById("galleryScroll");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");

  if (scrollContainer && prevBtn && nextBtn) {
    // Determine how far to scroll (the width of one item + gap)
    const getScrollStep = () => {
      const firstItem = scrollContainer.querySelector(".gallery-item");
      if (!firstItem) return 300; // Fallback

      const itemWidth = firstItem.offsetWidth;
      const gap = 20; // Matches the gap in your CSS
      return itemWidth + gap;
    };

    nextBtn.addEventListener("click", () => {
      scrollContainer.scrollBy({
        left: getScrollStep(),
        behavior: "smooth",
      });
    });

    prevBtn.addEventListener("click", () => {
      scrollContainer.scrollBy({
        left: -getScrollStep(),
        behavior: "smooth",
      });
    });

    // Optional: Hide/Show arrows based on scroll position
    const toggleArrows = () => {
      const scrollLeft = scrollContainer.scrollLeft;
      const maxScroll =
        scrollContainer.scrollWidth - scrollContainer.clientWidth;

      // Subtle fade for the buttons at the ends
      prevBtn.style.opacity = scrollLeft <= 5 ? "0.3" : "1";
      prevBtn.style.pointerEvents = scrollLeft <= 5 ? "none" : "auto";

      nextBtn.style.opacity = scrollLeft >= maxScroll - 5 ? "0.3" : "1";
      nextBtn.style.pointerEvents =
        scrollLeft >= maxScroll - 5 ? "none" : "auto";
    };

    scrollContainer.addEventListener("scroll", toggleArrows);
    // Initialize arrow state
    toggleArrows();
  }

  const setupCarousel = (scrollId, prevId, nextId, cardSelector = ".gallery-item") => {
    const container = document.getElementById(scrollId);
    const prev = document.getElementById(prevId);
    const next = document.getElementById(nextId);

    if (container && prev && next) {
      const getStep = () => {
        const firstCard = container.querySelector(cardSelector);

        if (!firstCard) {
          return 340;
        }

        const nextCard = firstCard.nextElementSibling;
        if (!nextCard) {
          return firstCard.getBoundingClientRect().width;
        }

        return nextCard.offsetLeft - firstCard.offsetLeft;
      };

      next.addEventListener("click", () =>
        container.scrollBy({ left: getStep(), behavior: "smooth" }),
      );
      prev.addEventListener("click", () =>
        container.scrollBy({ left: -getStep(), behavior: "smooth" }),
      );
    }
  };

  const setupProfessionalsRecipeCarousel = (scrollId, prevId, nextId) => {
    const container = document.getElementById(scrollId);
    const prev = document.getElementById(prevId);
    const next = document.getElementById(nextId);

    if (!container || !prev || !next) {
      return;
    }

    const getStep = () => {
      return container.clientWidth;
    };

    const toggleButtons = () => {
      const maxScroll = container.scrollWidth - container.clientWidth;
      const atStart = container.scrollLeft <= 5;
      const atEnd = container.scrollLeft >= maxScroll - 5;

      prev.style.opacity = atStart ? "0.45" : "1";
      prev.disabled = atStart;
      next.style.opacity = atEnd ? "0.45" : "1";
      next.disabled = atEnd;
    };

    prev.addEventListener("click", () => {
      container.scrollBy({ left: -getStep(), behavior: "smooth" });
    });

    next.addEventListener("click", () => {
      container.scrollBy({ left: getStep(), behavior: "smooth" });
    });

    container.addEventListener("scroll", toggleButtons, { passive: true });
    window.addEventListener("resize", toggleButtons);
    toggleButtons();
  };

  // Initialize all three carousels
  setupCarousel("galleryScroll", "prevBtn", "nextBtn");
  setupCarousel(
    "shopFeaturedCarousel",
    "shopFeaturedPrev",
    "shopFeaturedNext",
  );
  setupCarousel(
    "testimonialScroll",
    "prevTestimonial",
    "nextTestimonial",
    ".review-card",
  );
  setupCarousel("partnerScroll", "prevPartner", "nextPartner", ".partner-card");
  setupCarousel(
    "homeActualitatCarousel",
    "homeActualitatPrev",
    "homeActualitatNext",
    ".actualitat-card",
  );
  setupCarousel(
    "visitActivityReviewsScroll",
    "visitActivityReviewsPrev",
    "visitActivityReviewsNext",
  );
  setupProfessionalsRecipeCarousel(
    "professionalsFoundationsCarousel",
    "professionalsFoundationsPrev",
    "professionalsFoundationsNext",
  );
  setupProfessionalsRecipeCarousel(
    "professionalsRecipesCarousel",
    "professionalsRecipesPrev",
    "professionalsRecipesNext",
  );
  setupProfessionalsRecipeCarousel(
    "professionalsAuthorCarousel",
    "professionalsAuthorPrev",
    "professionalsAuthorNext",
  );
  setupProfessionalsRecipeCarousel(
    "gastronomicRecipesCarousel",
    "gastronomicRecipesPrev",
    "gastronomicRecipesNext",
  );
  setupProfessionalsRecipeCarousel(
    "gastronomicHomeCarousel",
    "gastronomicHomePrev",
    "gastronomicHomeNext",
  );
  setupProfessionalsRecipeCarousel(
    "gastronomicClassicsCarousel",
    "gastronomicClassicsPrev",
    "gastronomicClassicsNext",
  );
  setupProfessionalsRecipeCarousel(
    "gastronomicHealthyCarousel",
    "gastronomicHealthyPrev",
    "gastronomicHealthyNext",
  );
  setupProfessionalsRecipeCarousel(
    "gastronomicSweetCarousel",
    "gastronomicSweetPrev",
    "gastronomicSweetNext",
  );
  setupProfessionalsRecipeCarousel(
    "gastronomicRemediesCarousel",
    "gastronomicRemediesPrev",
    "gastronomicRemediesNext",
  );
  const setupHeaderDropdown = () => {
    const dropdownItems = Array.from(
      document.querySelectorAll(".nav-item--dropdown"),
    );

    if (!dropdownItems.length) {
      return;
    }

    const closeDropdown = (item) => {
      const button = item.querySelector(".nav-link-button");
      item.classList.remove("is-open");

      if (button) {
        button.setAttribute("aria-expanded", "false");
      }
    };

    const openDropdown = (item) => {
      dropdownItems.forEach((dropdownItem) => {
        if (dropdownItem !== item) {
          closeDropdown(dropdownItem);
        }
      });

      const button = item.querySelector(".nav-link-button");
      item.classList.add("is-open");

      if (button) {
        button.setAttribute("aria-expanded", "true");
      }
    };

    dropdownItems.forEach((dropdownItem) => {
      const trigger = dropdownItem.querySelector(".nav-link-button");

      if (!trigger) {
        return;
      }

      trigger.addEventListener("click", (event) => {
        event.stopPropagation();
        const isOpen = dropdownItem.classList.contains("is-open");

        if (isOpen) {
          closeDropdown(dropdownItem);
        } else {
          openDropdown(dropdownItem);
        }
      });
    });

    document.addEventListener("click", (event) => {
      dropdownItems.forEach((dropdownItem) => {
        if (!dropdownItem.contains(event.target)) {
          closeDropdown(dropdownItem);
        }
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        dropdownItems.forEach(closeDropdown);
      }
    });
  };

  const setupProfessionalsValueFeature = () => {
    const prev = document.getElementById("professionalsValuePrev");
    const next = document.getElementById("professionalsValueNext");
    const content = document.getElementById("professionalsValueContent");
    const eyebrow = document.getElementById("professionalsValueEyebrow");
    const intro = document.getElementById("professionalsValueIntro");
    const icon = document.getElementById("professionalsValueIcon");
    const title = document.getElementById("professionalsValueTitle");
    const text = document.getElementById("professionalsValueText");

    if (
      !prev ||
      !next ||
      !content ||
      !eyebrow ||
      !intro ||
      !icon ||
      !title ||
      !text
    ) {
      return;
    }

    const slides = [
      {
        eyebrow: "EL NOSTRE VALOR AFEGIT: MES QUE UN INGREDIENT, UN PROJECTE",
        intro:
          "En triar la Castanya de Viladrau com el seu proveidor de confianca, el seu establiment s'uneix a un projecte amb anima.",
        title: "RECUPERACIO DE BOSCOS",
        text: "Treballem activament en la neteja i revitalitzacio de les boscuries del Parc Natural del Montseny, recuperant castanyers centenaris que havien estat abandonats.",
        icon: `<svg width="137" height="118" viewBox="0 0 137 118" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M59.2998 0.644531C61.5117 0.516411 63.7237 0.473874 65.9355 0.514648H65.9375C72.355 0.602187 78.7053 1.53732 84.7129 3.2793V3.28027C91.0508 5.19102 96.1357 8.47913 99.2803 12.7656L99.4238 12.9619L99.668 12.9697C107.712 13.2245 115.791 13.9366 122.463 16.7969V16.7959C130.057 20.0656 135.726 26.1315 135.726 33.916C135.726 41.4573 130.406 47.385 123.158 50.7207L122.451 51.0352C115.934 53.8403 108.203 55.0393 100.38 55.3281L100.076 55.3398L99.9463 55.6152C97.9741 59.7981 95.0701 63.4751 91.8145 67.0498C90.1867 68.8371 88.4777 70.5919 86.7559 72.3721C85.2513 73.9276 83.738 75.5012 82.2715 77.123L81.6455 77.8213C74.1276 86.2871 67.6133 96.1923 67.6133 113.021C67.6132 114.007 67.108 114.987 66.1445 115.733C65.178 116.482 63.8449 116.916 62.4365 116.916H51.085C49.6766 116.916 48.3435 116.482 47.377 115.733C46.4136 114.987 45.9083 114.007 45.9082 113.021C45.9082 103.886 48.2783 96.7082 51.9072 90.8633L52.1865 90.4131L51.7207 90.1602C45.7283 86.8975 39.8818 83.2739 34.9795 78.6338C28.8089 72.7965 24.3801 65.3002 23.4062 55.6377L23.3643 55.2217L22.9482 55.1885C17.3613 54.7437 12.5006 53.5426 8.55469 51.3223H8.55371C3.41672 48.4132 0.5 43.5961 0.5 38.3105C0.500016 32.9747 3.62092 28.17 8.80176 25.29C12.7742 23.0859 18.2154 22.6305 23.8105 22.1885L24.1865 22.1582L24.2617 21.7891C25.4935 15.7235 29.1301 10.4926 34.8633 7.17188C41.7551 3.18073 50.4579 1.19639 59.3008 0.645508L59.2998 0.644531ZM33.7871 55.9502C34.7347 63.7519 38.1866 69.1979 43.0674 73.7969C46.9055 77.4357 51.7858 80.5273 57.1318 83.4863L57.4678 83.6719L57.7334 83.3965C60.0278 81.019 62.5445 78.7727 65.2627 76.6768L65.6719 76.3613L65.3428 75.9629C61.3326 71.1109 58.2378 64.3942 57.4521 55.8438L57.4102 55.3896H33.7188L33.7871 55.9502ZM67.8438 55.9463C68.5342 62.005 70.561 66.7404 72.9219 70.1992L73.2188 70.6338L73.6367 70.3154C75.4967 68.9047 77.2971 67.4767 79.0361 66.0303L79.0576 66.0127L79.0762 65.9922C82.2067 62.7341 85.3559 59.358 87.5615 56.1738L88.1055 55.3896H67.7803L67.8438 55.9463Z" fill="#EEE9DF" stroke="#EEE9DF"/>
</svg>
`,
      },
      {
        eyebrow:
          "ATRIBUTS QUE FAN DE LA NOSTRA CASTANYA UN INGREDIENT CLAU A LA CUINA",
        intro:
          "El nostre producte destaca en el paladar professional per tres caracteristiques clau derivades del seu origen.",
        title: "COMPROMIS SOSTENIBLE",
        text: "Som un projecte de Km 0 que aposta per l'economia circular i la preservacio del territori. Servir les nostres castanyes es explicar una historia de respecte per la natura als seus clients.",
        icon: `<svg width="137" height="118" viewBox="0 0 137 118" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M93.4045 104.696C85.5034 107.934 76.8611 109.606 68.1122 109.588C35.5637 109.588 9.08174 86.7625 9.08174 58.7082C9.08174 46.6731 13.8814 35.3074 22.7042 26.1921V35.2252H31.7858V11.7422H4.54093V19.5699H17.4459C6.18733 30.2927 -0.0324442 44.2463 0.000127282 58.7082C0.000127282 91.0795 30.5552 117.416 68.1122 117.416C78.2121 117.434 88.1885 115.503 97.3096 111.764L93.4045 104.696Z" fill="#EEE9DF"/>
<path d="M90.8154 31.3105C76.4665 31.3105 64.7013 40.9268 63.6705 53.0715C58.6785 49.1453 52.1652 46.9679 45.4074 46.9659H27.2441V62.6212C27.2441 75.5721 39.468 86.1042 54.489 86.1042H63.5706V101.76H72.6522V70.4489H81.7338C96.7548 70.4489 108.979 59.9167 108.979 46.9659V31.3105H90.8154ZM54.489 78.2765C44.472 78.2765 36.3258 71.2551 36.3258 62.6212V54.7935H45.4074C55.4244 54.7935 63.5706 61.815 63.5706 70.4489V72.7424L53.1585 63.768L46.7378 69.3021L57.1499 78.2765H54.489ZM99.897 46.9659C99.897 55.5998 91.7508 62.6212 81.7338 62.6212H79.0729L89.485 53.6468L83.0643 48.1126L72.6522 57.0871V54.7935C72.6522 46.1596 80.7984 39.1382 90.8154 39.1382H99.897V46.9659Z" fill="#EEE9DF"/>
<path d="M136.226 58.7076C136.226 26.3363 105.671 0.000126404 68.1139 0.000126404C58.014 -0.0179976 48.0376 1.91309 38.9165 5.6517L42.8216 12.7201C50.7227 9.48177 59.365 7.81008 68.1139 7.82779C100.662 7.82779 127.144 30.6533 127.144 58.7076C127.144 70.7427 122.345 82.1084 113.522 91.2237V82.1906H104.44V105.674H131.685V97.8459H118.78C130.039 87.1231 136.259 73.1695 136.226 58.7076Z" fill="#EEE9DF"/>
</svg>
`,
      },
      {
        eyebrow:
          "ATRIBUTS QUE FAN DE LA NOSTRA CASTANYA UN INGREDIENT CLAU A LA CUINA",
        intro:
          "El nostre producte destaca en el paladar professional per tres caracteristiques clau derivades del seu origen.",
        title: "TRIATGE I SELECCIO MANUAL",
        text: "El nostre valor diferencial es el factor huma. Revisem cada fruit per garantir que nomes el millor calibre i estat arribi a la seva cuina.",
        icon: `<svg width="137" height="118" viewBox="0 0 137 118" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M69.3234 0C69.3234 0 32.6948 13.0176 32.6948 29.0734C32.6948 45.1313 49.0922 58.1468 69.3234 58.1468C89.5522 58.1468 105.952 45.1313 105.952 29.0734C105.952 13.0176 69.3234 0 69.3234 0ZM69.3234 53.6058C55.6903 53.6058 49.0784 50.3603 44.1873 41.7951C52.7144 46.1696 58.065 47.7531 69.3234 47.7531C80.5794 47.7531 85.9799 46.1686 94.5083 41.7951C89.6196 50.3603 82.9566 53.6058 69.3234 53.6058Z" fill="#EEE9DF"/>
<path d="M131.099 82.3921C129.518 81.3564 127.676 80.6457 125.719 80.3153C123.761 79.9849 121.74 80.0438 119.814 80.4875L93.7005 85.5927C94.5565 83.6612 94.8489 81.582 94.5526 79.5333C94.2564 77.4846 93.3802 75.5276 91.9994 73.8301C90.6186 72.1326 88.7742 70.7452 86.6245 69.787C84.4747 68.8287 82.0838 68.3281 79.6567 68.3282H50.7609C48.486 68.3227 46.2324 68.7012 44.1309 69.4419C42.0293 70.1826 40.1215 71.2707 38.518 72.6431L25.1207 84.0366H8.08111C5.93787 84.0366 3.8824 84.7606 2.3669 86.0495C0.8514 87.3383 0 89.0863 0 90.909V110.544C0 112.367 0.8514 114.115 2.3669 115.404C3.8824 116.693 5.93787 117.417 8.08111 117.417H68.1122C68.3963 117.417 68.6794 117.387 68.9549 117.329L105.897 109.474C106.072 109.435 106.244 109.386 106.411 109.327L128.819 101.218L129.009 101.144C130.99 100.303 132.687 99.0461 133.94 97.4929C135.192 95.9396 135.959 94.1409 136.168 92.2659C136.377 90.391 136.021 88.5017 135.134 86.776C134.247 85.0503 132.859 83.545 131.099 82.4019V82.3921ZM6.92667 110.544V90.909C6.92667 90.6486 7.04829 90.3989 7.26479 90.2148C7.48129 90.0307 7.77493 89.9272 8.08111 89.9272H23.0889V111.526H8.08111C7.77493 111.526 7.48129 111.423 7.26479 111.239C7.04829 111.055 6.92667 110.805 6.92667 110.544ZM125.996 95.8179L103.946 103.805L67.6851 111.526H30.0155V88.2042L43.4129 76.8058C44.3756 75.9828 45.5208 75.3303 46.7821 74.8862C48.0434 74.4422 49.3958 74.2153 50.7609 74.2188H79.6567C81.7999 74.2188 83.8553 74.9429 85.3708 76.2317C86.8864 77.5205 87.7378 79.2686 87.7378 81.0912C87.7378 82.9139 86.8864 84.662 85.3708 85.9508C83.8553 87.2396 81.7999 87.9637 79.6567 87.9637H63.4944C62.5759 87.9637 61.695 88.274 61.0455 88.8263C60.396 89.3787 60.0311 90.1278 60.0311 90.909C60.0311 91.6901 60.396 92.4393 61.0455 92.9917C61.695 93.544 62.5759 93.8543 63.4944 93.8543H81.9655C82.2258 93.8546 82.4853 93.8299 82.739 93.7807L121.413 86.2161L121.551 86.1867C123.007 85.8492 124.558 85.981 125.906 86.5567C127.255 87.1324 128.305 88.1115 128.856 89.3059C129.408 90.5003 129.42 91.8257 128.892 93.0277C128.365 94.2296 127.333 95.2233 125.996 95.8179Z" fill="#EEE9DF"/>
</svg>
`,
      },
    ];

    let currentIndex = 0;

    const renderSlide = (index, direction = "next") => {
      const slide = slides[index];
      const exitClass =
        direction === "prev"
          ? "is-switching-left"
          : "is-switching-right";
      const enterClass =
        direction === "prev" ? "is-entering-left" : "is-entering-right";

      content.classList.remove(
        "is-switching",
        "is-switching-left",
        "is-switching-right",
        "is-entering",
        "is-entering-left",
        "is-entering-right",
      );
      content.classList.add("is-switching", exitClass);

      window.setTimeout(() => {
        eyebrow.textContent = slide.eyebrow;
        intro.textContent = slide.intro;
        title.textContent = slide.title;
        text.textContent = slide.text;
        icon.innerHTML = slide.icon;
        content.classList.remove("is-switching", exitClass);
        content.classList.add("is-entering", enterClass);

        window.requestAnimationFrame(() => {
          content.classList.remove(enterClass);
        });

        window.setTimeout(() => {
          content.classList.remove("is-entering");
        }, 220);
      }, 180);
    };

    prev.addEventListener("click", () => {
      currentIndex = (currentIndex - 1 + slides.length) % slides.length;
      renderSlide(currentIndex, "prev");
    });

    next.addEventListener("click", () => {
      currentIndex = (currentIndex + 1) % slides.length;
      renderSlide(currentIndex, "next");
    });
  };

  const setupContactForm = () => {
    const form = document.getElementById("contactForm");
    const status = document.getElementById("contactFormStatus");

    if (!form || !status) {
      return;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const submitButton = form.querySelector('button[type="submit"]');
      const formData = new FormData(form);
      const preferredTime = formData.get("preferredTime");
      const business = formData.get("business");
      const visibleMessage = formData.get("message");
      const composedMessage =
        visibleMessage ||
        [
          "Sol.licitud de contacte professional.",
          preferredTime ? `Horari preferit: ${preferredTime}` : "",
          business ? `Negoci o projecte: ${business}` : "",
        ]
          .filter(Boolean)
          .join("\n");

      const payload = {
        type: "contact",
        data: {
          name: formData.get("name") || "Consulta web",
          email: formData.get("email") || "info@castanyadeviladrau.cat",
          phone: formData.get("phone"),
          business,
          message: composedMessage,
        },
      };

      submitButton.disabled = true;
      status.textContent = "Enviant consulta...";

      try {
        const response = await fetch("/.netlify/functions/send-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error("Request failed");
        }

        form.reset();
        status.textContent =
          "Consulta enviada correctament. En Joaquim et respondra al mes aviat possible.";
      } catch (error) {
        status.textContent =
          "No hem pogut enviar la consulta ara mateix. Torna-ho a provar en uns minuts.";
      } finally {
        submitButton.disabled = false;
      }
    });
  };

  const setupFustaShowcase = () => {
    const prev = document.getElementById("fustaShowcasePrev");
    const next = document.getElementById("fustaShowcaseNext");
    const heroImage = document.getElementById("fustaShowcaseHeroImage");
    const eyebrow = document.getElementById("fustaShowcaseEyebrow");
    const title = document.getElementById("fustaShowcaseTitle");
    const text = document.getElementById("fustaShowcaseText");
    const detailTitle = document.getElementById("fustaShowcaseDetailTitle");
    const detailP1 = document.getElementById("fustaShowcaseDetailP1");
    const detailP2 = document.getElementById("fustaShowcaseDetailP2");
    const detailP3 = document.getElementById("fustaShowcaseDetailP3");
    const detailImage = document.getElementById("fustaShowcaseDetailImage");
    const slideNodes = document.querySelectorAll(".fusta-showcase-slide-data");

    if (
      !prev ||
      !next ||
      !heroImage ||
      !eyebrow ||
      !title ||
      !text ||
      !detailTitle ||
      !detailP1 ||
      !detailP2 ||
      !detailP3 ||
      !detailImage ||
      !slideNodes.length
    ) {
      return;
    }

    const slides = Array.from(slideNodes).map((slide) => slide.dataset);
    let index = 0;

    const renderSlide = () => {
      const slide = slides[index];
      heroImage.src = slide.heroImage;
      heroImage.alt = slide.heroAlt;
      eyebrow.textContent = slide.eyebrow;
      title.textContent = slide.title;
      text.textContent = slide.text;
      detailTitle.textContent = slide.detailTitle;
      detailP1.textContent = slide.detailP1;
      detailP2.textContent = slide.detailP2;
      detailP3.textContent = slide.detailP3;
      detailImage.src = slide.detailImage;
      detailImage.alt = slide.detailAlt;
    };

    prev.addEventListener("click", () => {
      index = (index - 1 + slides.length) % slides.length;
      renderSlide();
    });

    next.addEventListener("click", () => {
      index = (index + 1) % slides.length;
      renderSlide();
    });

    renderSlide();
  };

  setupProfessionalsValueFeature();
  setupHeaderDropdown();
  setupContactForm();
  setupFustaShowcase();
});
